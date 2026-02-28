import React, { useEffect, useState } from 'react';
import { fetchWorkOrders } from '../../services/workOrderService';
import {
    WorkOrdersContainer,
    WorkOrdersTableWrapper,
    Table,
    TableHeader,
    TableCell,
} from './WorkOrdersStyles';

const WorkOrdersTable = () => {
    const [workOrders, setWorkOrders] = useState<any[]>([]);

    useEffect(() => {
        const getWorkOrders = async () => {
            const data = await fetchWorkOrders();
            setWorkOrders(data);
        };
        getWorkOrders();
    }, []);

    return (
        <WorkOrdersContainer>
            <WorkOrdersTableWrapper>
                <Table>
                    <thead>
                        <tr>
                            <TableHeader>W.O</TableHeader>
                            <TableHeader>STATUS</TableHeader>
                            <TableHeader>BILL TO CO</TableHeader>
                            <TableHeader>TRAILER</TableHeader>
                            <TableHeader>MECHANIC</TableHeader>
                            <TableHeader>DATE</TableHeader>
                            <TableHeader>DESCRIPTION</TableHeader>
                            <TableHeader>PRT1</TableHeader>
                            <TableHeader>QTY1</TableHeader>
                            <TableHeader>$1</TableHeader>
                            <TableHeader>TTL HRS</TableHeader>
                            <TableHeader>TTL LAB & PARTS</TableHeader>
                        </tr>
                    </thead>
                    <tbody>
                        {workOrders.map((order: any) => (
                            <tr key={order.id}>
                                <TableCell>{order.wo}</TableCell>
                                <TableCell>{order.status}</TableCell>
                                <TableCell>{order.billToCo}</TableCell>
                                <TableCell>{order.trailer}</TableCell>
                                <TableCell>{order.mechanic}</TableCell>
                                <TableCell>{order.date}</TableCell>
                                <TableCell>{order.description}</TableCell>
                                <TableCell>{order.prt1}</TableCell>
                                <TableCell>{order.qty1}</TableCell>
                                <TableCell>{order.price1}</TableCell>
                                <TableCell>{order.ttlHrs}</TableCell>
                                <TableCell>{order.ttlLabParts}</TableCell>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </WorkOrdersTableWrapper>
        </WorkOrdersContainer>
    );
};

export default WorkOrdersTable;