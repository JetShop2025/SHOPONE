import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { authenticateUser } from '../../services/authService';
import {
    LoginContainer,
    LoginFormWrapper,
    InputField,
    SubmitButton,
} from './LoginStyles';

interface LoginFormProps {
    onLogin: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const history = useHistory();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Please fill in all fields.');
            return;
        }

        try {
            await authenticateUser(username, password);
            onLogin();
            history.push('/work-orders');
        } catch (err) {
            setError('Invalid username or password.');
        }
    };

    return (
        <LoginContainer>
            <h2>Login</h2>
            {error && <p className="error">{error}</p>}
            <LoginFormWrapper onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="username">Username:</label>
                    <InputField
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="password">Password:</label>
                    <InputField
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    />
                </div>
                <SubmitButton type="submit">Login</SubmitButton>
            </LoginFormWrapper>
        </LoginContainer>
    );
};

export default LoginForm;