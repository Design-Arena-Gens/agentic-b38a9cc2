import Upload from '../components/Upload';

export default function Page() {
  return (
    <main className="main">
      <h1>CT vs MRI Analyzer</h1>
      <p className="subtitle">
        Upload a DICOM, PNG, or JPEG image. The analyzer will parse metadata and use
        image features to predict whether it is a CT or MRI.
      </p>
      <Upload />
    </main>
  );
}
