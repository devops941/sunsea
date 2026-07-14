import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './app/store';
import { injectStore } from './api/apiClient';

import App from './App';


// Custom CSS
import './assets/css/style.css';
import './assets/css/responsive.css';

// Toastify
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

// Inject store to avoid circular dependency in axios client
injectStore(store);

ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />

        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          pauseOnHover
          draggable
          theme="light"
        />
        
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);