const express = require('express');
const httpProxy = require('express-http-proxy');
const session = require('express-session');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 3600000 }
}));

const users = { 'testuser': { password: 'HOPB', password2: '2014-03-11', secret: null, twoFactorEnabled: false } };

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!users[username] || users[username].password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.step1Authenticated = true;
    req.session.username = username;
    req.session.loginTime = Date.now();
    res.json({ message: 'First step passed. Please enter second password.', requiresSecondPassword: true });
});

app.post('/auth/verify-password', (req, res) => {
    if (!req.session.step1Authenticated) {
        return res.status(401).json({ error: 'Must complete first step' });
    }
    const { password2 } = req.body;
    const username = req.session.username;
    if (users[username].password2 !== password2) {
        return res.status(401).json({ error: 'Invalid second password' });
    }
    req.session.authenticated = true;
    res.json({ message: 'Login successful', authenticated: true });
});

app.post('/auth/logout', (req, res) => {
    req.session.authenticated = false;
    req.session.step1Authenticated = false;
    res.json({ message: 'Logged out' });
});

const checkAuth = (req, res, next) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ error: 'Not authenticated. Please login.' });
    }
    next();
};

app.use('/proxy', checkAuth, httpProxy('http://example.com', { proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/proxy/, '') }));

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    console.log(`Default test user:`);
    console.log(`  Username: testuser`);
    console.log(`  First Password: HOPB`);
    console.log(`  Second Password: 2014-03-11`);
    console.log(`API Endpoints:`);
    console.log(`  POST /auth/login - Login with username/password`);
    console.log(`  POST /auth/verify-password - Verify second password`);
    console.log(`  POST /auth/logout - Logout`);
    console.log(`  /proxy/* - Proxied requests (requires authentication)`);
});