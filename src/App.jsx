import Router from "./routes/Router.jsx";
import { ToastProvider } from "./context/ToastContext.jsx"; // Import here

export default function App() {
  return (
    <ToastProvider>
      <Router />
    </ToastProvider>
  );
}