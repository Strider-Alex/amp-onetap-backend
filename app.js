const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const cors = require('cors');
const url = require('url');
const jwtDecode = require('jwt-decode');
const app = express();
const port = 3000;

const upload = multer();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.use(cookieParser());

app.set('view engine', 'ejs');

const whitelist = ['http://localhost:3000', 'http://localhost:8000', 'http://ampcache.com:8000'];
let _origin = null;
const corsOptions = {
  origin: function (origin, callback) {
    _origin = origin;
    if (whitelist.indexOf(origin) !== -1) {
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
  console.log("amp-access called");
  res.setHeader('AMP-Access-Control-Allow-Source-Origin', _origin);
  res.setHeader('Access-Control-Expose-Headers', 'AMP-Access-Control-Allow-Source-Origin');
  if (req.cookies.tokenID) {
    const decoded = jwtDecode(req.cookies.tokenID);
    res.json({ 
      user: true,
      given_name: decoded.given_name,
      email: decoded.email,
      picture: decoded.picture,
    });
  }
  else {
    res.json({ user: false  });
  }
});

app.get('/amp-subscriptions', cors(corsOptions), (req, res) => {
  console.log("amp-subscriptions called");
  res.setHeader('AMP-Access-Control-Allow-Source-Origin', _origin);
  res.setHeader('Access-Control-Expose-Headers', 'AMP-Access-Control-Allow-Source-Origin');
  if (req.cookies.tokenID) {
    const decoded = jwtDecode(req.cookies.tokenID);
    const data = {
      loggedIn: true,
      given_name: decoded.given_name,
      email: decoded.email,
      picture: decoded.picture,
    };
    console.log(data);
    res.json({
      granted: true,
      grantReason: "SUBSCRIBER",
      data : data
    });
  }
  else {
    res.json({
      granted: false,
      grantReason: "SUBSCRIBER",
      data : {
        loggedIn: false
      }
    });
  }
});

app.post('/login-xhr', [cors(corsOptions), upload.none()], (req, res) => {
  res.cookie('tokenID', req.body.credential);
  res.json({ success: 1 });
});

app.get('/logout', (req, res) => {
  if (req.cookies.tokenID) {
    res.clearCookie('tokenID');
  }
  res.redirect(`${req.query.return}#success=true`);
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
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
