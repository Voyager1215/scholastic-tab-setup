import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPage } from './admin/AdminPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SubjectPage } from './pages/SubjectPage';
import { ViewerPage } from './pages/ViewerPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="subject/:slug" element={<SubjectPage />} />
        <Route path="view/:id" element={<ViewerPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
