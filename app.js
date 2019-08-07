const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const cors = require('cors');
const url = require('url');
const jwtDecode = require('jwt-decode');
const base64url = require('base64url');
const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const app = express();
const port = 3000;

const upload = multer();

const credentials =
    JSON.parse(fs.readFileSync('credentials/credentials.json', 'utf8'));
const CLIENT_ID = credentials.client_id;
const CLIENT_SECRET = credentials.client_secret;
const CODE_URL = credentials.google_oauth_code_url;
const TOKEN_URL = credentials.google_oauth_token_url;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// parse application/json
app.use(bodyParser.json());

app.use(cookieParser());

app.set('view engine', 'ejs');

app.use(express.static('public'));

const whitelist = [
  'http://localhost:3000', // origin for the intermediate iframe
  'http://localhost:8000', // cache origin for the AMP page
  'http://example.com:8000'// publisher origin for the AMP page
];
let _origin = null;
const corsOptions = {
  origin: function(origin, callback) {
    _origin = origin;
    if (origin == null || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Not allowed: ' + origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET',
  credentials: true
};

app.get('/amp-access', cors(corsOptions), (req, res) => {
  console.log('amp-access called');
  res.setHeader(
      'AMP-Access-Control-Allow-Source-Origin',
      _origin || 'http://localhost:8000');
  res.setHeader(
      'Access-Control-Expose-Headers',
      'AMP-Access-Control-Allow-Source-Origin');
  if (req.cookies.IdToken) {
    const decoded = jwtDecode(req.cookies.IdToken);
    res.json({
      user: true,
      given_name: decoded.given_name,
      email: decoded.email,
      picture: decoded.picture,
    });
  } else {
    res.json({user: false});
  }
});

app.get('/amp-subscriptions', cors(corsOptions), (req, res) => {
  console.log('amp-subscriptions called');
  res.setHeader('AMP-Access-Control-Allow-Source-Origin', _origin);
  res.setHeader(
      'Access-Control-Expose-Headers',
      'AMP-Access-Control-Allow-Source-Origin');
  if (req.cookies.IdToken == 'empty') {
    res.json({
      granted: true,
      grantReason: 'SUBSCRIBER',
      data: {
        loggedIn: true,
        given_name: 'Non Google User',
        email: 'nobody@example.com'
      }
    });
  } else if (req.cookies.IdToken) {
    const decoded = jwtDecode(req.cookies.IdToken);
    console.log(decoded);
    const data = {
      loggedIn: true,
      given_name: decoded.given_name,
      email: decoded.email,
      picture: decoded.picture,
    };
    res.json({granted: true, grantReason: 'SUBSCRIBER', data: data});
  } else {
    res.json(
        {granted: false, grantReason: 'SUBSCRIBER', data: {loggedIn: false}});
  }
});

app.post('/login-xhr', [cors(corsOptions), upload.none()], (req, res) => {
  res.cookie('IdToken', req.body.credential);
  res.json({success: 1});
});

app.post(
    '/password-login-form', [cors(corsOptions), upload.none()], (req, res) => {
      res.cookie('IdToken', 'empty');
      res.redirect(`${req.body.returnurl}#success=true`);
    });

app.get('/logout', (req, res) => {
  if (req.cookies.IdToken) {
    res.clearCookie('IdToken');
  }
  res.redirect(`${req.query.return}#success=true`);
});

app.get('/amp-validation-error-example', (req, res) => {
  res.render('amp-validation-error-example');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/onetap', (req, res) => {
  let origin;
  const referer = req.get('Referer');
  if (referer) {
    const q = url.parse(referer, true);
    origin = `${q.protocol}//${q.host}`;
  }
  res.set('X-Frame-Options', 'DENY');
  if (whitelist.indexOf(origin) !== -1) {
    res.set({
      'Content-Security-Policy': `frame-ancestors ${origin}`,
      'X-Frame-Options': `ALLOW-FROM ${origin}`,
    });
  }
  res.render('onetap');
});

app.get('/oauth/google-sign-in', cors(corsOptions), (req, res) => {
  const returnURL = req.query.return;
  const stateStr = base64url(`{ "returnURL":"${returnURL}" }`);
  res.redirect(
      `${CODE_URL}?` +
      `client_id=${CLIENT_ID}` +
      `&redirect_uri=${
          encodeURI('http://localhost:3000/oauth/google-sign-in-redirect')}` +
      `&scope=${encodeURI('openid profile email')}&` +
      `&response_type=code` +
      `&state=${stateStr}`);
});

app.get('/oauth/google-sign-in-redirect', cors(corsOptions), (req, res) => {
  const error = req.query.error;
  if (error) {
    console.log(error);
    res.send(error);
  } else {
    console.log(JSON.parse(base64url.decode(req.query.state)));
    const returnURL = JSON.parse(base64url.decode(req.query.state)).returnURL;
    const postData = {
      grant_type: 'authorization_code',
      code: req.query.code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: 'http://localhost:3000/oauth/google-sign-in-redirect',
    };
    axios
      .post(
        TOKEN_URL,
        qs.stringify(postData),
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}})
      .then((response) => {
        console.log(response.data.id_token);
        if (response.data.id_token) {
          res.cookie('IdToken', response.data.id_token);
        }
        res.redirect(returnURL);
      })
      .catch((error) => {
        console.error(error);
        res.send(error);
      });
  }
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
