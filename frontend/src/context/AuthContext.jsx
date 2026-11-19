import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const logout = () => {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    };

    fetch('http://localhost:8000/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || 'Token inválido');
        return data;
      })
      .then(userData => setUser(userData))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email, password) => {
    let res;
    try {
      res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.trim(), password })
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor. Inicie el backend en el puerto 8000.');
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.detail || 'Error al iniciar sesión');
    }
    if (!data?.access_token || !data?.user) {
      throw new Error('La respuesta del servidor no contiene una sesión válida.');
    }

    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
