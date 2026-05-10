import HTML from './html';

export default function Home() {
  return <div dangerouslySetInnerHTML={{ __html: HTML }} />;
}
