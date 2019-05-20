const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const app = express()
const port = 3000

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
 
// parse application/json
app.use(bodyParser.json())

app.use(cookieParser())

app.set('view engine', 'ejs');

const whitelist = ['http://localhost:8000', 'http://ampcache.com:8000']
let _origin = null;
const corsOptions = {
  origin: function (origin, callback) {
    _origin = origin
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: 'GET',
  credentials: true
}


app.get('/amp-access', cors(corsOptions), (req, res) => {
  res.setHeader('AMP-Access-Control-Allow-Source-Origin', _origin)
  res.setHeader('Access-Control-Expose-Headers', 'AMP-Access-Control-Allow-Source-Origin')
  if(req.cookies.tokenID){
    res.json({user:true})
  }
  else{
    res.json({user:false})
  }
})

app.post('/', cors(corsOptions), (req, res) => {
  console.log(req.body.credential);
  res.cookie('tokenID', req.body.credential);
  res.redirect('back');
})

app.get('/logout', (req, res) => {
  if(req.cookies.tokenID){
    res.clearCookie('tokenID')
  }
  res.redirect(`${req.query.return}#success=true`); 
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
