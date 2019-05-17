SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

DROP FUNCTION [dbo].[normalizeGuid]
GO

CREATE FUNCTION [dbo].[normalizeGuid] (
	@input VARCHAR(38)
)
RETURNS UNIQUEIDENTIFIER
BEGIN
	SET @input = REPLACE(REPLACE(REPLACE(@input, '-', ''),'{',''), '}', '');
	RETURN CAST(
        SUBSTRING(@input, 1, 8) + '-' + SUBSTRING(@input, 9, 4) + '-' + SUBSTRING(@input, 13, 4) + '-' +
        SUBSTRING(@input, 17, 4) + '-' + SUBSTRING(@input, 21, 12)
        AS UNIQUEIDENTIFIER);
END
GO

DROP FUNCTION [dbo].[splitString]
GO

CREATE FUNCTION [dbo].[splitString](
	@input VARCHAR(max), 
	@Splitter VARCHAR(99)
) 
RETURNS TABLE 
AS
RETURN
  WITH tmp (DataItem, List , FIRST) AS
   ( SELECT @input  ,@input,   1  --first item ignored, set to get the type right
     UNION ALL
     SELECT LEFT(List, CHARINDEX(@Splitter,List+@Splitter)-1),
        STUFF(List, 1, CHARINDEX(@Splitter,List+@Splitter), ''), 
		0 
		FROM tmp 
		WHERE List <> ''
   ) SELECT DataItem 
     FROM tmp 
	 WHERE FIRST=0 
	 AND DataItem <> ''
GO

DROP FUNCTION [dbo].[sitecore_fn_GetFieldValue]
GO

CREATE FUNCTION [dbo].[sitecore_fn_GetFieldValue](
	@ID UNIQUEIDENTIFIER,
	@FN VARCHAR(250)
)
RETURNS VARCHAR(4000)
BEGIN
	RETURN(
		SELECT TOP 1 CASE WHEN f.Value IS NULL THEN '' ELSE f.Value END
		FROM [dbo].[fields] f WITH(NOLOCK)
		JOIN [dbo].[Items] fi WITH(NOLOCK) ON fi.Id = f.FieldId AND fi.Name = @FN
		WHERE f.ItemId = @ID
	)
END
GO

DROP PROCEDURE [dbo].[SitecoreGetMediaByPath]
GO

CREATE PROCEDURE [dbo].[SitecoreGetMediaByPath](
	@input VARCHAR(4000),
	@maxsize INT = 0
)
AS 
BEGIN
	DECLARE @parent UNIQUEIDENTIFIER = '3D6658D8-A0BF-4E75-B3E2-D050FABCF4E1';
	DECLARE @target UNIQUEIDENTIFIER;
	DECLARE @tbl TABLE ([idx] int IDENTITY(0,1), [name] VARCHAR(4000), [id] UNIQUEIDENTIFIER);
	DECLARE @ext VARCHAR(50);
	DECLARE @path VARCHAR(4000);
	DECLARE @idx INT = 0;

	DECLARE @extlen INT = CHARINDEX('.', REVERSE(@input));
	SET @ext = SUBSTRING(@input, ((LEN(@input) - (@extlen - 2))), (@extlen));
	SET @path = SUBSTRING(@input, 0, (LEN(@input) - (@extlen - 1)));

	INSERT INTO @tbl ([name])
	SELECT DataItem FROM dbo.splitString(@path, '/');
	
	DECLARE @segcount INT = (SELECT COUNT(*) FROM @tbl);

	WHILE (@idx < @segcount )
	BEGIN
		IF((@idx + 1) < @segcount)
		BEGIN
			SET @parent = (SELECT [ID] FROM Items WHERE [Name] = (SELECT [name] FROM @tbl WHERE [idx] = @idx) AND [ParentID] = @parent);
		END
		ELSE
		BEGIN
			SET @target = (	SELECT TOP 1 i.ID
							FROM Items i
							JOIN Fields f ON f.[ItemID] = i.[ID] AND f.[FIELDID] = 'C06867FE-9A43-4C7D-B739-48780492D06F' AND f.[Value] = @ext
							WHERE i.[Name] = (SELECT [name] FROM @tbl WHERE [idx] = @idx)
							AND i.[ParentId] = @parent);
		END
		SET @idx = @idx + 1;
	END

	SELECT	[index],
			dbo.sitecore_fn_GetFieldValue(@target, 'Mime Type') as MimeType,
			dbo.sitecore_fn_GetFieldValue(@target, 'Size') as Size,
			dbo.sitecore_fn_GetFieldValue(@target, '__Updated') as Updated,
			CASE WHEN @maxsize > 0 
				THEN CASE WHEN (CAST(dbo.sitecore_fn_GetFieldValue(@target, 'Size') AS INT) * 2) >= @maxsize
					THEN NULL
					ELSE Data 
				END
				ELSE Data 
			END AS [Data]
	FROM Blobs
	WHERE [BlobId] = dbo.sitecore_fn_GetFieldValue(@target, 'blob')
	ORDER BY [index] ASC;
END
GO

DROP PROCEDURE [dbo].[SitecoreGetMediaByID]
GO

CREATE PROCEDURE [dbo].[SitecoreGetMediaByID] (
	@input VARCHAR(38),
	@maxsize INT = 0
)
AS
BEGIN
	DECLARE @target UNIQUEIDENTIFIER = [dbo].[normalizeGuid](@input);
	SELECT	[index],
			dbo.sitecore_fn_GetFieldValue(@target, 'Mime Type') as MimeType,
			dbo.sitecore_fn_GetFieldValue(@target, 'Size') as Size,
			dbo.sitecore_fn_GetFieldValue(@target, '__Updated') as Updated,
			CASE WHEN @maxsize > 0 
				THEN CASE WHEN (CAST(dbo.sitecore_fn_GetFieldValue(@target, 'Size') AS INT) * 2) >= @maxsize
					THEN NULL
					ELSE Data 
				END
				ELSE Data 
			END AS [Data]
	FROM Blobs
	WHERE [BlobId] = dbo.sitecore_fn_GetFieldValue(@target, 'blob')
	ORDER BY [index] ASC;
END
GO