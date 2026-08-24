import { ToastContainer } from "react-toastify";

/**
 * Toastify container — always dark theme.
 */
const ThemedToastContainer = () => {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      pauseOnHover
      draggable
      theme="dark"
    />
  );
};

export default ThemedToastContainer;
