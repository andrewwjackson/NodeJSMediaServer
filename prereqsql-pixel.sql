USE <your tracking db name>
GO

CREATE TABLE pixel_logs (
	requestId		UNIQUEIDENTIFIER PRIMARY KEY,
	pixelId			UNIQUEIDENTIFIER,
	pixelName		NVARCHAR(25), -- Try to keep these at a sane length
	pixelReferer	NVARCHAR(253), -- Max domain name length	
	clientIP		NVARCHAR(15), -- This can get messy, make sure we're only grabbing the first xff entry
	userAgent		NVARCHAR(MAX),
	ts				DateTime
);
GO

CREATE PROCEDURE pixel_log (
	@pixelid UNIQUEIDENTIFIER,
	@pixelname NVARCHAR(25),
	@pixelreferer NVARCHAR(253),
	@clientip	NVARCHAR(15),
	@useragent	NVARCHAR(MAX)
)AS
BEGIN
	INSERT INTO pixel_logs
	SELECT NEWID(),
	@pixelid,
	@pixelname,
	@pixelreferer
	@clientip,
	@useragent,
	GETUTCDATE();
END