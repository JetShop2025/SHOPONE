import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import LoginForm from './components/Login/LoginForm';
import MenuOptions from './components/Menu/MenuOptions';
import WorkOrdersTable from './components/WorkOrders/WorkOrdersTable';
import InventoryList from './components/Inventory/InventoryList';

import { ThemeProvider } from 'styled-components';
import { theme } from './theme';
import { GlobalStyles } from './GlobalStyles';

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const handleLogin = () => {
        setIsAuthenticated(true);
    };

    return (
        <ThemeProvider theme={theme}>
          <Router>
              <GlobalStyles />
              <div>
                  {!isAuthenticated ? (
                      <LoginForm onLogin={handleLogin} />
                  ) : (
                      <>
                          <MenuOptions />
                          <Switch>
                              <Route path="/work-orders" component={WorkOrdersTable} />
                              <Route path="/inventory" component={InventoryList} />
                          </Switch>
                      </>
                  )}
              </div>
          </Router>
        </ThemeProvider>
    );
};

export default App;