'use strict';

import RedisStore from 'connect-redis';
import _ from 'underscore';
import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import passport from 'passport';
import session from 'express-session';
import config from 'config';
import flash from 'express-flash';
import {createClient} from 'redis';
import moment from 'moment';
import { marked } from 'marked';
import methodOverride from 'method-override';
import {OAuth2Strategy} from 'passport-google-oauth';

import models from './lib/models';
import permission from './lib/permission';
import audit from './lib/audit';
import mapHelper from './lib/mapHelper';

// Routers
import indexRouter from './routes/index';
import userRouter from './routes/user';
import authRouter from './routes/auth';
import adminCampaignRouter from './routes/admin/campaign';

import skillRouter from './routes/skill';
import skillSourceRouter from './routes/skill_source';
import skillSourceTypeRouter from './routes/skill_source_type';
import skillUsageRouter from './routes/skill_usage';
import skillTagRouter from './routes/skill_tag';
import skillStatusRouter from './routes/skill_status';

import attributeRouter from './routes/attribute';

import auditRouter from './routes/audit';

import glossaryStatusRouter from './routes/glossary_status';
import glossaryEntryRouter from './routes/glossary_entry';

import rulebookRouter from './routes/rulebook';

import mapRouter from './routes/map';

import imageRouter from './routes/image';

import characterRouter from './routes/character';
import characterFieldRouter from './routes/character_field';
import cpGrantRouter from './routes/cp_grant';

import reportRouter from './routes/report';

import pageRouter from './routes/page';

import eventRouter from './routes/event';

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
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'pug');

if (config.get('app.logRequests')){
    app.use(logger('dev'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride(function(req){
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
        const method = req.body._method;
        delete req.body._method;
        return method;
    }
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

interface sessionConfig{
    secret: string,
    rolling: boolean,
    saveUninitialized: boolean,
    resave: boolean,
    store?: null | RedisStore
}

const sessionConfig: sessionConfig = {
    secret: config.get('app.sessionSecret'),
    rolling: true,
    saveUninitialized: true,
    resave: false,
};

if (config.get('app.sessionType') === 'redis'){

    let redisClient = null;
    if (config.get('app.redis.url')){
        interface clientOptions{
            url: string,
            tls?: null|object
        }

        const options: clientOptions = {
            url: config.get('app.redis.url') ,
        };
        if (config.get('app.redis.tls')){
            options.url += '?ssl_cert_reqs=none'
            options.tls = {rejectUnauthorized: false};
        }
        redisClient = createClient(options);
    } else {
        redisClient = createClient();
    }
    redisClient.on('connect', function() {
        console.log('Using redis for sessions');
    });
    redisClient.on('error', (err: Error | string)  => {
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
        console.log('using site defaults');
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
    type Theme = {
        default: boolean,
        dir: string
    }
    const theme: Theme = config.get(`themes.${campaign.theme}`);
    if (theme.default){
        res.locals.cssTheme = false;
    } else {
        res.locals.cssTheme = theme.dir;
    }
    if (req.session){
        req.session.campaignId = campaign.id;
    }
    if (req.campaign.google_client_id && req.campaign.google_client_secret){
        if (!_.has(passport.strategies, `google-campaign-${campaign.id}`)){
            passport.use(`google-campaign-${campaign.id}`, new OAuth2Strategy({
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

passport.serializeUser(function(user: CampaignUser, cb) {
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

passport.use(new OAuth2Strategy({
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
            email: profile.emails[0].value
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
    res.locals.menuDark = req.campaign.menu_dark;
    res.locals._ = _;
    res.locals.moment = moment;
    res.locals.activeUser = req.user;
    res.locals.marked = marked;
    res.locals.capitalize = function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    };
    res.locals.mapCount = await mapHelper.countPCVisible(req.campaign.id);
    const user: CampaignUser = req.session.assumed_user ? req.session.assumed_user: (req.user as CampaignUser);
    if (user){
        res.locals.characterCount = await req.models.character.count({ campaign_id: req.campaign.id, user_id: user.id });
    } else {
        res.locals.characterCount = 0;
    }
    next();
});


app.use('/', indexRouter);
app.use('/user', userRouter);
app.use('/auth', authRouter);
app.use('/skill', skillRouter);
app.use('/skill_source', skillSourceRouter);
app.use('/skill_source_type', skillSourceTypeRouter);
app.use('/skill_usage', skillUsageRouter);
app.use('/skill_tag', skillTagRouter);
app.use('/skill_status', skillStatusRouter);
app.use('/attribute', attributeRouter);
app.use('/audit', auditRouter);
app.use('/glossary_status', glossaryStatusRouter);
app.use('/glossary', glossaryEntryRouter);
app.use('/rulebook', rulebookRouter);
app.use('/map', mapRouter);
app.use('/character', characterRouter);
app.use('/cp_grant', cpGrantRouter);
app.use('/image', imageRouter);
app.use('/report', reportRouter);
app.use('/character_field', characterFieldRouter);
app.use('/page', pageRouter);
app.use('/event', eventRouter)

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
    next();
});

export default app;
