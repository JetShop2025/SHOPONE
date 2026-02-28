import React, { useEffect, useState } from 'react';
import { fetchInventoryItems } from '../../services/inventoryService';
import {
    InventoryContainer,
    InventoryTitle,
    InventoryTable,
    InventoryTableHeader,
    InventoryTableCell,
} from './InventoryStyles';

const InventoryList = () => {
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadInventoryItems = async () => {
            try {
                const items = await fetchInventoryItems();
                // compute total received by SKU (or id if sku missing)
                const totals: Record<string, number> = {};
                items.forEach((it: any) => {
                    const key = it.sku ?? it.id;
                    const r = it.received ?? it.receivedQuantity ?? it.qtyReceived ?? 0;
                    totals[key] = (totals[key] || 0) + r;
                });

                // collapse to unique SKUs, keeping one representative item
                const unique: any[] = [];
                items.forEach((it: any) => {
                    const key = it.sku ?? it.id;
                    if (!unique.some((x: any) => (x.sku ?? x.id) === key)) {
                        unique.push({ ...it, totalReceived: totals[key] });
                    }
                });

                setInventoryItems(unique);
            } catch (err) {
                setError(String(err));
            } finally {
                setLoading(false);
            }
        };

        loadInventoryItems();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <InventoryContainer>
            <InventoryTitle>Inventory List</InventoryTitle>
            <InventoryTable>
                <thead>
                    <tr>
                        <InventoryTableHeader>Item ID</InventoryTableHeader>
                        <InventoryTableHeader>Name</InventoryTableHeader>
                        <InventoryTableHeader>Quantity</InventoryTableHeader>
                        <InventoryTableHeader>Location</InventoryTableHeader>
                        <InventoryTableHeader>Price</InventoryTableHeader>
                        <InventoryTableHeader>Total Received</InventoryTableHeader>
                    </tr>
                </thead>
                <tbody>
                    {inventoryItems.map((item: any) => (
                        <tr key={item.id}>
                            <InventoryTableCell>{item.id}</InventoryTableCell>
                            <InventoryTableCell>{item.name}</InventoryTableCell>
                            <InventoryTableCell>{item.quantity}</InventoryTableCell>
                            <InventoryTableCell>{item.location}</InventoryTableCell>
                            <InventoryTableCell>{item.price}</InventoryTableCell>
                            <InventoryTableCell>
                                {item.totalReceived ?? 0}
                            </InventoryTableCell>
                        </tr>
                    ))}
                </tbody>
            </InventoryTable>
        </InventoryContainer>
    );
};

export default InventoryList;