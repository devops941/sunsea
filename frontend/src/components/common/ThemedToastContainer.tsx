import { ToastContainer } from "react-toastify";
import { useTheme } from "../../providers/ThemeProvider";

const ThemedToastContainer = () => {
  const { mode } = useTheme();
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      pauseOnHover
      draggable
      theme={mode}
    />
  );
};

export default ThemedToastContainer;
