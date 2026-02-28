import React from 'react';
import { useHistory } from 'react-router-dom';
import { MenuContainer, MenuItem } from './MenuStyles';

const MenuOptions: React.FC = () => {
    const history = useHistory();

    const navigateToWorkOrders = () => {
        history.push('/work-orders');
    };

    const navigateToInventory = () => {
        history.push('/inventory');
    };

    return (
        <MenuContainer>
            <MenuItem onClick={navigateToWorkOrders}>Work Orders</MenuItem>
            <MenuItem onClick={navigateToInventory}>Inventory</MenuItem>
        </MenuContainer>
    );
};

export default MenuOptions;