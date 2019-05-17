SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE function [dbo].[splitString](@input Varchar(max), @Splitter Varchar(99)) returns table as
Return
  with tmp (DataItem, List , First) as
   ( select @input  ,@input,   1  --first item ignored, set to get the type right
     union all
     select LEFT(List, CHARINDEX(@Splitter,List+@Splitter)-1),
        STUFF(List, 1, CHARINDEX(@Splitter,List+@Splitter), ''), 0 from tmp where List <> ''
   ) select DataItem from tmp where first=0 and DataItem <> ''
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
		JOIN [dbo].[Items] fi WITH(NOLOCK) on fi.Id = f.FieldId AND fi.Name = @FN
		WHERE f.ItemId = @ID
	)
END
GO

--todo: add size check
CREATE PROCEDURE [dbo].[SitecoreGetMediaByPath](
	@testpath VARCHAR(4000)
)
AS 
BEGIN
	DECLARE @parent UNIQUEIDENTIFIER = '3D6658D8-A0BF-4E75-B3E2-D050FABCF4E1';
	DECLARE @target UNIQUEIDENTIFIER;
	DECLARE @tbl TABLE (idx int IDENTITY(0,1), name VARCHAR(4000), id UNIQUEIDENTIFIER);
	DECLARE @ext VARCHAR(50);
	DECLARE @path VARCHAR(4000);
	DECLARE @idx int = 0;

	DECLARE @extlen INT = CHARINDEX('.', REVERSE(@testpath));
	SET @ext = SUBSTRING(@testpath, ((LEN(@testpath) - (@extlen - 2))), (@extlen));
	SET @path = SUBSTRING(@testpath, 0, (LEN(@testpath) - (@extlen - 1)));

	INSERT INTO @tbl (name)
	SELECT DataItem FROM dbo.splitString(@path, '/');
	
	DECLARE @segcount int = (SELECT COUNT(*) FROM @tbl);

	WHILE (@idx < @segcount )
	BEGIN
		IF((@idx + 1) < @segcount)
		BEGIN
			SET @parent = (SELECT ID FROM Items WHERE Name = (SELECT name FROM @tbl WHERE idx = @idx) AND ParentID = @parent);
		END
		ELSE
		BEGIN
			SET @target = (	SELECT TOP 1 i.ID
							FROM Items i
							JOIN Fields f on f.ItemId = i.ID AND f.FIELDID = 'C06867FE-9A43-4C7D-B739-48780492D06F' AND f.Value = @ext
							WHERE i.Name = (SELECT name FROM @tbl WHERE idx = @idx)
							AND i.ParentId = @parent);
		END
		SET @idx = @idx + 1;
	END

	SELECT	[index],
			dbo.sitecore_fn_GetFieldValue(@target, 'Mime Type') as MimeType,
			dbo.sitecore_fn_GetFieldValue(@target, 'Size') as Size,
			dbo.sitecore_fn_GetFieldValue(@target, '__Updated') as Updated,
			Data
	FROM Blobs
	WHERE BlobId = dbo.sitecore_fn_GetFieldValue(@target, 'blob')
	ORDER BY [index] ASC;
END
