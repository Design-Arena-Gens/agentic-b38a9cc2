"use client";

import { useCallback, useMemo, useRef, useState } from 'react';
import { isLikelyDicom, parseDicom } from '../lib/dicom';
import { computeFeaturesFromImageData, classifyFeatures, normalizeDicomToGrayscale8 } from '../lib/analysis';

type Result = {
  label: 'CT' | 'MRI';
  probabilityCT: number;
  probabilityMRI: number;
  modality?: string;
  meta?: Record<string, string | number | undefined>;
};

export default function Upload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onPick = useCallback(() => inputRef.current?.click(), []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      if (isLikelyDicom(bytes)) {
        const info = parseDicom(arrayBuffer);
        if (!info) throw new Error('Failed to parse DICOM');
        if (!info.rows || !info.columns || !info.pixelData) throw new Error('Missing pixel data');

        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(info.columns, info.rows));
        const width = Math.max(1, Math.floor(info.columns * scale));
        const height = Math.max(1, Math.floor(info.rows * scale));

        const rgba = normalizeDicomToGrayscale8(info.pixelData, {
          rows: info.rows,
          columns: info.columns,
          rescaleSlope: info.rescaleSlope,
          rescaleIntercept: info.rescaleIntercept,
          windowCenter: info.windowCenter,
          windowWidth: info.windowWidth
        });

        const temp = document.createElement('canvas');
        temp.width = info.columns;
        temp.height = info.rows;
        const tctx = temp.getContext('2d')!;
        const imageData = new ImageData(rgba, info.columns, info.rows);
        tctx.putImageData(imageData, 0, 0);

        canvas.width = width;
        canvas.height = height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(temp, 0, 0, width, height);

        const analyzed = ctx.getImageData(0, 0, width, height);
        const features = computeFeaturesFromImageData(analyzed);
        const classification = classifyFeatures(features);

        setResult({
          label: classification.label,
          probabilityCT: classification.probabilityCT,
          probabilityMRI: classification.probabilityMRI,
          modality: info.modality,
          meta: {
            modality: info.modality,
            transferSyntax: info.transferSyntax,
            rows: info.rows,
            columns: info.columns,
            windowCenter: info.windowCenter,
            windowWidth: info.windowWidth,
            rescaleSlope: info.rescaleSlope,
            rescaleIntercept: info.rescaleIntercept,
            frames: info.numberOfFrames
          }
        });
      } else {
        const img = new Image();
        img.onload = () => {
          const maxDim = 768;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const width = Math.max(1, Math.floor(img.width * scale));
          const height = Math.max(1, Math.floor(img.height * scale));
          canvas.width = width;
          canvas.height = height;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const analyzed = ctx.getImageData(0, 0, width, height);
          const features = computeFeaturesFromImageData(analyzed);
          const classification = classifyFeatures(features);
          setResult({
            label: classification.label,
            probabilityCT: classification.probabilityCT,
            probabilityMRI: classification.probabilityMRI
          });
        };
        img.onerror = () => setError('Failed to load image');
        const blob = new Blob([bytes], { type: file.type || 'application/octet-stream' });
        img.src = URL.createObjectURL(blob);
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, []);

  const onChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFile(file);
  }, [handleFile]);

  const probabilities = useMemo(() => {
    if (!result) return null;
    const ct = (result.probabilityCT * 100).toFixed(1);
    const mri = (result.probabilityMRI * 100).toFixed(1);
    return { ct, mri };
  }, [result]);

  return (
    <div className="card">
      <div className="row">
        <div style={{ flex: '1 1 320px' }}>
          <input
            ref={inputRef}
            type="file"
            accept=".dcm,image/png,image/jpeg"
            onChange={onChange}
            style={{ display: 'none' }}
          />
          <button onClick={onPick} disabled={loading}>
            {loading ? 'Analyzing…' : 'Choose Image or DICOM'}
          </button>
          {error && <div className="result" style={{ background: '#ffecec', borderColor: '#ffd0d0' }}>{error}</div>}
          {result && (
            <div className={`result ${loading ? 'progress' : ''}`}>
              <div><strong>Prediction:</strong> {result.label}</div>
              {probabilities && (
                <div className="meta">CT: {probabilities.ct}% · MRI: {probabilities.mri}%</div>
              )}
              {result.modality && (
                <div className="meta">DICOM Modality (metadata): {result.modality}</div>
              )}
              {result.meta && (
                <details style={{ marginTop: 8 }}>
                  <summary>Metadata</summary>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result.meta, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </div>
        <div style={{ flex: '2 1 400px' }}>
          <canvas ref={canvasRef} className="preview" />
        </div>
      </div>
    </div>
  );
}
