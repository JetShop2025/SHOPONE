import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';

const Container = styled.div`
    padding: 20px;
    background-color: ${(props: any) => props.theme.colors.background};
    min-height: 100vh;
`;

const Title = styled.h1`
    color: ${(props: any) => props.theme.colors.primary};
    margin-bottom: 20px;
`;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    background-color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const TableHeader = styled.th`
    background-color: ${(props: any) => props.theme.colors.primary};
    color: white;
    padding: 12px;
    text-align: left;
`;

const TableCell = styled.td`
    padding: 10px 12px;
    border-bottom: 1px solid #ddd;
`;

const Auditoria: React.FC = () => {
    const [audits, setAudits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAudits = async () => {
            try {
                const response = await axios.get('/api/audit');
                setAudits(response.data);
            } catch (error) {
                console.error('Error fetching audits:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAudits();
    }, []);

    if (loading) {
        return <Container><Title>Loading...</Title></Container>;
    }

    return (
        <Container>
            <Title>Auditoría</Title>
            {audits.length === 0 ? (
                <p>No audit records found.</p>
            ) : (
                <Table>
                    <thead>
                        <tr>
                            <TableHeader>ID</TableHeader>
                            <TableHeader>User</TableHeader>
                            <TableHeader>Action</TableHeader>
                            <TableHeader>Table</TableHeader>
                            <TableHeader>Record ID</TableHeader>
                            <TableHeader>Timestamp</TableHeader>
                        </tr>
                    </thead>
                    <tbody>
                        {audits.map((audit: any) => (
                            <tr key={audit.id}>
                                <TableCell>{audit.id}</TableCell>
                                <TableCell>{audit.user || audit.usuario || 'N/A'}</TableCell>
                                <TableCell>{audit.action || audit.accion || 'N/A'}</TableCell>
                                <TableCell>{audit.table || audit.tabla || 'N/A'}</TableCell>
                                <TableCell>{audit.recordId || audit.registroId || 'N/A'}</TableCell>
                                <TableCell>{audit.timestamp || audit.fecha || 'N/A'}</TableCell>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </Container>
    );
};

export default Auditoria;
