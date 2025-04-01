
async function showCheckin(req, res, next){
    const eventId = req.params.id;
    try {
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
                { url: `/event/${event.id}`, name: event.name },
            ],
            current: `Check-in`
        };

        res.locals.event = event;
        res.locals.title += ` - ${event.name} - Check-in`;
        res.locals.csrfToken = req.csrfToken();

        res.render('event/checkin');

    } catch (err){
        return next(err);
    }

}

async function markCheckedIn(req, res, next){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Attendance');
        }

        await req.models.attendance.update(attendance.id, {checked_in:true})
        res.json({success:true, checked_in:true});
    } catch(err){
        return next(err);
    }

}

async function unmarkCheckedIn(req, res, next){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Attendance');
        }

        await req.models.attendance.update(attendance.id, {checked_in:false})
        res.json({success:true, checked_in:false});
    } catch(err){
        return next(err);
    }

}

export default {
    show: showCheckin,
    checkin: markCheckedIn,
    uncheckin: unmarkCheckedIn
};
