export var JobStatus;
(function (JobStatus) {
    JobStatus["Saved"] = "saved";
    JobStatus["Applied"] = "applied";
    JobStatus["Interviewing"] = "interviewing";
    JobStatus["Offer"] = "offer";
    JobStatus["Rejected"] = "rejected";
    JobStatus["Archived"] = "archived";
})(JobStatus || (JobStatus = {}));
export var ApplicationStatus;
(function (ApplicationStatus) {
    ApplicationStatus["Applied"] = "applied";
    ApplicationStatus["InterviewScheduled"] = "interview_scheduled";
    ApplicationStatus["Interviewed"] = "interviewed";
    ApplicationStatus["OfferReceived"] = "offer_received";
    ApplicationStatus["Rejected"] = "rejected";
    ApplicationStatus["Withdrawn"] = "withdrawn";
})(ApplicationStatus || (ApplicationStatus = {}));
