import Router from "./routes/Router.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import NotificationsProvider from "./notifications/NotificationsProvider.jsx";
import PushNotificationPrompt from "./components/PushNotificationPrompt.jsx";

export default function App() {
  return (
    <ToastProvider>
      <NotificationsProvider>
        <Router />
        <PushNotificationPrompt />
      </NotificationsProvider>
    </ToastProvider>
  );
}
