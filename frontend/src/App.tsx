import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import EmailView from './pages/EmailView';
import Collections from './pages/Collections';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/email/:id" element={<EmailView />} />
          <Route path="/collections" element={<Collections />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
