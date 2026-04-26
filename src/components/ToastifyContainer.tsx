import { ToastContainer } from 'react-toastify';

// TODO: Put into App.tsx instead of ToastContainer
const ToastifyContainer = () => {
  return (
    <ToastContainer
      position="top-right" 
      autoClose={3000}
      hideProgressBar
      closeOnClick={false}
      theme="dark"
    />
  );
};

export default ToastifyContainer;