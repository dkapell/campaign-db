'use strict';
const _ = require('underscore');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const passport = require('passport');
const session = require('express-session');
const config = require('config');
const flash = require('express-flash');
const redis = require('redis');
const moment = require('moment');
const {marked} = require('marked');
const methodOverride = require('method-override');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

const models = require('./lib/models');
const permission = require('./lib/permission');
const audit = require('./lib/audit');
const mapHelper = require('./lib/mapHelper');




const indexRouter = require('./routes/index');
const userRouter = require('./routes/user');
const authRouter = require('./routes/auth');
const adminCampaignRouter = require('./routes/admin/campaign');

const skillRouter = require('./routes/skill');
const skillSourceRouter = require('./routes/skill_source');
const skillSourceTypeRouter = require('./routes/skill_source_type');
const skillTypeRouter = require('./routes/skill_type');
const skillUsageRouter = require('./routes/skill_usage');
const skillTagRouter = require('./routes/skill_tag');
const skillStatusRouter = require('./routes/skill_status');

const auditRouter = require('./routes/audit');

const glossaryStatusRouter = require('./routes/glossary_status');
const glossaryEntryRouter = require('./routes/glossary_entry');

const rulebookRouter = require('./routes/rulebook');

const mapRouter = require('./routes/map');

const imageRouter = require('./routes/image');

const characterRouter = require('./routes/character');
const app = express();

// if running in SSL Only mode, redirect to SSL version
if (config.get('app.secureOnly')){
    app.all('*', function(req, res, next){
        if (req.originalUrl.match(/\/insecure-api\//)){
            return next();
        }
        if (req.headers['x-forwarded-proto'] !== 'https') {
            res.redirect('https://' + req.headers.host + req.url);
        } else {
            next();
        }
    });
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

if (config.get('app.logRequests')){
    app.use(logger('dev'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride(function(req, res){
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
        const method = req.body._method;
        delete req.body._method;
        return method;
    }
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const sessionConfig = {
    secret: config.get('app.sessionSecret'),
    rolling: true,
    saveUninitialized: true,
    resave: false,
};

if (config.get('app.sessionType') === 'redis'){
    const RedisStore = require('connect-redis').default;

    let redisClient = null;
    if (config.get('app.redis.url')){
        const options = {
            url: config.get('app.redis.url')
        };
        if (config.get('app.redis.tls')){
            options.tls = {rejectUnauthorized: false};
        }
        redisClient = redis.createClient(options);
    } else {
        redisClient = redis.createClient();
    }
    redisClient.on('connect', function() {
        console.log(`Using ${redisType} for Sessions`);
    });
    redisClient.on('error', err => {
        console.log('Error ' + err);
    });

    (async() => {
        await redisClient.connect().catch(console.error);
    })();

    sessionConfig.store = new RedisStore({ client: redisClient });
    sessionConfig.resave = true;
}

app.use(session(sessionConfig));
app.use(flash());

app.use(function(req, res, next){
    req.models = models;
    next();
});

app.use(permission());
app.use(audit());

// Figure out what campaign is active, based on URL
app.use(async function(req, res, next){
    let campaign = await models.campaign.getBySite(req.headers.host);
    if (!campaign){
        campaign = await models.campaign.findOne({default_site: true});
    }
    if (!campaign){
        campaign = {
            id: 0,
            name: `${config.get('app.name')} Admin Site`,
            theme: 'Flatly',
            css: '',
            site: req.headers.host,
            default_to_player: false,
            default_site:true,
            description: `This is the root site of ${config.get('app.name')}`
        };
    }
    req.campaign = campaign;

    res.locals.currentCampaign = campaign;
    res.locals.cssTheme = config.get(`themes.${campaign.theme}.dir`);

    req.session.campaignId = campaign.id;
    if (req.campaign.google_client_id && req.campaign.google_client_secret){
        if (!_.has(passport._strategies, `google-campaign-${campaign.id}`)){
            passport.use(`google-campaign-${campaign.id}`, new GoogleStrategy({
                clientID: req.campaign.google_client_id,
                clientSecret: req.campaign.google_client_secret,
                callbackURL: config.get('auth.callbackURL'),
                passReqToCallback: true
            }, passportVerifyGoogle));
        }
    }
    next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, cb) {
    cb(null, user.id);
});

passport.deserializeUser(async function(req, id, cb) {
    try{
        const user = await models.user.get(req.campaign.id, id);
        cb(null, user);
    } catch (err){
        cb(err);
    }
});

passport.use(new GoogleStrategy({
    clientID: config.get('auth.clientID'),
    clientSecret: config.get('auth.clientSecret'),
    callbackURL: config.get('auth.callbackURL'),
    passReqToCallback: true
}, passportVerifyGoogle));

async function passportVerifyGoogle(req, accessToken, refreshToken, profile, cb) {
    try{
        const user = await models.user.findOrCreate(req.campaign.id, {
            name: profile.displayName,
            google_id: profile.id,
            email: profile.emails[0].value,
            type: req.campaign.default_to_player?'player':'none'
        });
        cb(null, user);
    } catch (err) {
        cb(err);
    }
}

// Set common helpers for the view
app.use(async function(req, res, next){
    res.locals.config = config;
    res.locals.session = req.session;
    res.locals.siteName = req.campaign.name;
    res.locals.title = req.campaign.name;
    res.locals._ = _;
    res.locals.moment = moment;
    res.locals.activeUser = req.user;
    res.locals.marked = marked;
    res.locals.capitalize = function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    };
    res.locals.mapCount = await mapHelper.countPCVisible(req.campaign.id);
    next();
});


app.use('/', indexRouter);
app.use('/user', userRouter);
app.use('/auth', authRouter);
app.use('/skill', skillRouter);
app.use('/skill_source', skillSourceRouter);
app.use('/skill_source_type', skillSourceTypeRouter);
app.use('/skill_type', skillTypeRouter);
app.use('/skill_usage', skillUsageRouter);
app.use('/skill_tag', skillTagRouter);
app.use('/skill_status', skillStatusRouter);
app.use('/audit', auditRouter);
app.use('/glossary_status', glossaryStatusRouter);
app.use('/glossary', glossaryEntryRouter);
app.use('/rulebook', rulebookRouter);
app.use('/map', mapRouter);
app.use('/character', characterRouter);
app.use('/image', imageRouter);

app.use('/admin/campaign', adminCampaignRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    if (req.app.get('env') === 'development'){
        console.error('Requested: ' + req.originalUrl);
    }
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    if (req.app.get('env') === 'development' && err.status !== 404){
        console.trace(err);
    }
    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
