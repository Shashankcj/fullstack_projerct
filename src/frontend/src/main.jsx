import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // ← Add this import
import App from './App';
import './App.css';

import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './redux/store';

import { WebSocketProvider } from './Contexts/WebSocketContext.jsx';
import { AuthProvider } from './Contexts/AuthContext.jsx';
import { RefreshProvider } from './Contexts/RefreshContext.jsx';
import { SidebarProvider } from './Contexts/SidebarContext.jsx'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate persistor={persistor} loading={null}>
        <BrowserRouter basename="/app"> {/* ← Add basename here */}
          <AuthProvider>
            <WebSocketProvider>
              <RefreshProvider defaultInterval={5}>
                <SidebarProvider>
                  <App />
                </SidebarProvider>
              </RefreshProvider>
            </WebSocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);
