const { google } = require('googleapis');
const { s3 } = require('./profile');
const Booking = require('../../models/Booking');
const calendar = google.calendar('v3');


exports.createBooking = async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/google');
    }

    const nameArray = req.user.name.toString().split(" ");
    const firstName = nameArray[0];
    const lastName = nameArray.length > 1 ? nameArray[1] : '';

    const agent = {
        firstName,
        lastName,
        email: req.user.email,
        mobile: "+1 34567830",
    };

    const vendors = {
        firstName: "Ausrealty",
        lastName: "Careers",
        email: "careersausrealty@gmail.com",
        mobile: "+134567830",
    };

    const name = "162 BELMORE ROAD RIVERWOOD NSW 2210";
    const description = "Ausrealty Careers need to book a time slot for a client.";
    const { startTime, endTime } = req.body;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
        access_token: req.user.accessToken
    });

    const calendarId = 'primary';

    try {
        // Check for existing events in the given time slot
        const { data } = await calendar.events.list({
            auth: oauth2Client,
            calendarId: calendarId,
            timeMin: startTime,
            timeMax: endTime,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = data.items;

        if (events.length > 0) {
            return res.status(409).json({ message: 'Time slot is already booked.' });
        }

        // Create a new event in Google Calendar
        const event = {
            summary: 'Reserved Time Slot',
            start: { dateTime: startTime, timeZone: 'Australia/Sydney' },
            end: { dateTime: endTime, timeZone: 'Australia/Sydney' },
            reminders: {
                useDefault: false,
                overrides: [{ method: 'popup', minutes: 60 }],
            },
        };

        const eventResponse = await calendar.events.insert({
            auth: oauth2Client,
            calendarId: calendarId,
            resource: event,
        });

        // Extract the Google event ID
        const googleEventId = eventResponse.data.id;

        // Save the booking in MongoDB with the Google event ID
        const booking = new Booking({
            name,
            description,
            vendors,
            agent,
            startTime,
            endTime,
            googleEventId,  // Save the Google event ID
            status: 'Active',
        });

        await booking.save();

        res.status(201).json({ message: 'Booking created', event: eventResponse.data, booking });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};



// reschedule event
exports.rescheduleBooking = async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/google');
    }

    const { eventId } = req.params; // This should be the Google event ID
    const { startTime, endTime } = req.body;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
        access_token: req.user.accessToken
    });

    try {
        // Reschedule the event in Google Calendar
        const eventResponse = await calendar.events.patch({
            auth: oauth2Client,
            calendarId: 'primary',
            eventId,
            resource: {
                start: { dateTime: startTime, timeZone: 'Australia/Sydney' },
                end: { dateTime: endTime, timeZone: 'Australia/Sydney' },
                reminders: {
                    useDefault: false,
                    overrides: [{ method: 'popup', minutes: 60 }],
                },
            },
        });

        // Update the booking in MongoDB
        const booking = await Booking.findOneAndUpdate(
            { googleEventId: eventId }, // Use the Google event ID for the lookup
            { startTime, endTime },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        res.status(200).json({ message: 'Booking rescheduled', event: eventResponse.data, booking });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// Cancel Booking
exports.cancelBooking = async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/google');
    }

    const { eventId } = req.params; // This should be the Google event ID

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
        access_token: req.user.accessToken
    });

    try {
        // Delete the event in Google Calendar
        await calendar.events.delete({
            auth: oauth2Client,
            calendarId: 'primary',
            eventId,
        });

        // Update the booking status in MongoDB
        const booking = await Booking.findOneAndUpdate(
            { googleEventId: eventId }, // Use the Google event ID for the lookup
            { status: 'Cancelled' },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        res.status(200).json({ message: 'Booking canceled', booking });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllBookings = async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/google');
    }

    try {
        const bookings = await Booking.find({}).exec();

        if (!bookings.length) {
            return res.status(404).json({ message: 'No bookings found' });
        }

        res.status(200).json({ bookings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};




// exports.uploadImage= async (req, res) => {
//     const { fileName, fileType } = req.query;

//     const s3Params = {
//         Bucket: process.env.S3_BUCKET_NAME,
//         Key: fileName,
//         Expires: 60, // URL expires in 60 seconds
//         ContentType: fileType,
//         ACL: 'public-read', // Make file publicly readable
//     };

//     try {
//         const uploadURL = await s3.getSignedUrlPromise('putObject', s3Params);
//         res.json({ uploadURL });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };
