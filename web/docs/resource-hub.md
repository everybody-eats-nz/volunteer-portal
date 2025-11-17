# Resource Hub Feature

The Resource Hub allows administrators to upload and manage documents (PDFs, images, documents, links, and videos) that are publicly accessible to all volunteers. Users can search, filter, and browse resources organized by categories and tags.

## Implementation Details

### Features

- ✅ Admin file upload to Supabase Storage (PDFs, images, documents)
- ✅ External link and video URL support
- ✅ Public resource browsing without authentication
- ✅ Advanced search and filtering (category, type, tags)
- ✅ Auto-applying filters for better UX
- ✅ Resource categorization (TRAINING, POLICIES, FORMS, GUIDES, RECIPES, SAFETY, GENERAL)
- ✅ Flexible tagging system
- ✅ Publish/unpublish toggle for draft management
- ✅ File size validation (50MB limit)
- ✅ File type validation per resource type
- ✅ Edit resource metadata and files
- ✅ Delete resources with confirmation
- ✅ Responsive admin table and public grid layout

### Architecture

**Storage**: Supabase Storage (bucket: `resource-hub`)
**Database**: PostgreSQL via Prisma ORM
**Authentication**: NextAuth.js (admin-only for uploads)
**File Upload**: FormData with validation
**UI Components**: shadcn/ui with Tailwind CSS

## Supabase Setup

### 1. Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to Storage section
3. Create a new bucket named **`resource-hub`**
4. Set bucket to **Public** (for read access)
5. Configure RLS policies:

```sql
-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'resource-hub');

-- Allow authenticated users to insert (handled by service role)
CREATE POLICY "Admin insert access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-hub');

-- Allow authenticated users to delete (handled by service role)
CREATE POLICY "Admin delete access"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resource-hub');
```

### 2. Environment Variables

Add these to your `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**IMPORTANT**: The `SUPABASE_SERVICE_ROLE_KEY` is required for admin file uploads as it bypasses RLS policies. Get this from your Supabase project settings under API.

### 3. Verify Bucket Configuration

The storage configuration is in `/src/lib/storage.ts`:

```typescript
export const STORAGE_BUCKET = "resource-hub"; // Must match your bucket name
```

## Database Schema

### Resource Model

Located in `/prisma/schema.prisma`:

```prisma
model Resource {
  id          String           @id @default(cuid())
  title       String
  description String?
  type        ResourceType
  category    ResourceCategory
  tags        String[]         @default([])
  fileUrl     String?          // For uploaded files
  fileName    String?
  fileSize    Int?
  url         String?          // For external links/videos
  isPublished Boolean          @default(true)
  uploadedBy  String
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  uploader    User             @relation("ResourceUploader", fields: [uploadedBy], references: [id])

  @@index([type])
  @@index([category])
  @@index([isPublished])
}

enum ResourceType {
  PDF
  IMAGE
  DOCUMENT
  LINK
  VIDEO
}

enum ResourceCategory {
  TRAINING
  POLICIES
  FORMS
  GUIDES
  RECIPES
  SAFETY
  GENERAL
}
```

### Migration

Run the migration to add the Resource model:

```bash
cd web
npm run prisma:migrate -- dev --name add_resource_hub
```

## Admin Interface

### Location
- **Admin Page**: `/admin/resources`
- **Components**:
  - `AdminResourcesTable` - Resource management table
  - `CreateResourceDialog` - Upload new resources
  - `EditResourceDialog` - Edit existing resources

### Upload Workflow

1. Click "Upload Resource" button
2. Select resource type (PDF, Image, Document, Link, or Video)
3. For files:
   - Upload file (validated by type and size)
   - Max file size: 50MB
4. For links/videos:
   - Enter URL
5. Fill in metadata:
   - Title (required)
   - Description (optional)
   - Category (required)
   - Tags (comma-separated, optional)
6. Set publish status
7. Click "Upload Resource"

### Edit Workflow

1. Click "⋯" menu on resource row
2. Select "Edit"
3. Update any fields:
   - Change resource type
   - Upload new file (optional, keeps existing if not changed)
   - Update title, description, category, tags
   - Toggle publish status
4. Click "Update Resource"

### Delete Workflow

1. Click "⋯" menu on resource row
2. Select "Delete"
3. Confirm deletion
4. Resource and associated file removed

### Table Features

- View all resources with metadata
- Filter by status (published/draft)
- Quick publish/unpublish toggle
- Download/open file actions
- Edit and delete actions
- Shows uploader information
- Displays file size and creation date

## Public Interface

### Location
- **Public Page**: `/resources`
- **Components**:
  - `ResourcesSearch` - Search and filter interface
  - `ResourcesGrid` - Resource card grid display

### Search & Filter Features

**Search Bar**: Full-text search across title and description

**Category Filter**:
- All Categories
- Training
- Policies
- Forms
- Guides
- Recipes
- Safety
- General

**Type Filter**:
- All Types
- PDF
- Image
- Document
- Link
- Video

**Tag Filtering**: Click tags to filter (supports multiple tags)

**Auto-Apply**: Filters automatically apply when changed (no manual submit needed for dropdowns and tags)

**Clear Filters**: Reset all filters to defaults

### Resource Cards

Each card displays:
- Resource type badge (color-coded)
- Title and description
- Category
- Tags (first 3, with +N indicator)
- File size (for uploaded files)
- Created date
- Download/Open button

## API Endpoints

### Public Endpoints

#### GET `/api/resources`
Returns all published resources with optional filtering.

**Query Parameters**:
- `search` (string) - Search title/description
- `category` (ResourceCategory) - Filter by category
- `type` (ResourceType) - Filter by type
- `tags` (string) - Comma-separated tag list

**Response**:
```json
{
  "resources": [
    {
      "id": "clxxx",
      "title": "Orientation Guide",
      "description": "New volunteer orientation materials",
      "type": "PDF",
      "category": "TRAINING",
      "tags": ["orientation", "new-volunteers"],
      "fileUrl": "https://...",
      "fileName": "orientation.pdf",
      "fileSize": 2048000,
      "isPublished": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "availableTags": ["orientation", "kitchen", "safety"]
}
```

#### GET `/api/resources/[id]`
Returns a single resource by ID (published only for non-admins).

### Admin Endpoints (Authentication Required)

#### GET `/api/admin/resources`
Returns all resources (including drafts) with uploader information.

**Response**: Includes `uploader` relation with full user details.

#### POST `/api/admin/resources`
Create a new resource.

**Request Body**:
```json
{
  "title": "Kitchen Safety Guide",
  "description": "Essential safety procedures",
  "type": "PDF",
  "category": "SAFETY",
  "tags": ["safety", "kitchen"],
  "fileUrl": "https://...",
  "fileName": "safety-guide.pdf",
  "fileSize": 1024000,
  "isPublished": true
}
```

#### PUT `/api/admin/resources/[id]`
Update an existing resource.

**Request Body**: Same as POST, all fields optional except what's being updated.

#### DELETE `/api/admin/resources/[id]`
Delete a resource and its associated file from storage.

#### POST `/api/admin/resources/upload`
Upload a file to Supabase Storage.

**Request**: FormData with:
- `file` (File) - The file to upload
- `resourceType` (ResourceType) - Type of resource (validates file type)

**Response**:
```json
{
  "fileUrl": "https://...",
  "fileName": "document.pdf",
  "fileSize": 2048000
}
```

## File Validation

### Allowed File Types

Configured in `/src/lib/storage.ts`:

```typescript
export const ALLOWED_FILE_TYPES = {
  PDF: ["application/pdf"],
  IMAGE: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
  DOCUMENT: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
```

### Validation Flow

1. **Client-side**: Input `accept` attribute restricts file picker
2. **Upload endpoint**: Validates file type matches resource type
3. **Storage utility**: Checks file size < 50MB
4. **Supabase**: Final validation on upload

## Component Architecture

### Admin Components

**`/src/components/admin-resources-table.tsx`**
- Table display with actions
- Delete confirmation dialog
- Publish/unpublish toggle
- Download/open actions

**`/src/components/create-resource-dialog.tsx`**
- Form with react-hook-form + zod validation
- Dynamic UI based on resource type
- File upload with preview
- Tag input (comma-separated)

**`/src/components/edit-resource-dialog.tsx`**
- Pre-populated form with current values
- Optional file replacement
- Shows current file info
- Full metadata editing

### Public Components

**`/src/components/resources-search.tsx`**
- Search input with Enter key support
- Category/type dropdown filters (auto-apply)
- Tag badges with toggle selection
- Clear filters button

**`/src/components/resources-grid.tsx`**
- Responsive grid layout
- Resource cards with metadata
- Download/open links
- Empty state handling

### Utility Libraries

**`/src/lib/storage.ts`**
- File upload/delete functions
- File validation utilities
- Supabase client configuration
- File size formatting

**`/src/lib/supabase.ts`**
- Supabase client initialization
- Service role client (admin operations)
- Environment variable configuration

## Error Handling

### Upload Errors

- **File too large**: "File size exceeds 50MB limit"
- **Invalid file type**: "Invalid file type for [type]"
- **Upload failed**: "Failed to upload file: [error]"
- **Missing service key**: "Supabase service role key not configured"

### API Errors

All API routes return standardized error responses:

```json
{
  "error": "Error message here"
}
```

HTTP Status Codes:
- `400` - Validation errors, invalid input
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (not admin)
- `404` - Resource not found
- `500` - Server errors

### User Feedback

Uses `sonner` toast notifications:
- Success: "Resource uploaded successfully"
- Error: Specific error message from API
- Loading states on buttons during operations

## Security Considerations

### Authentication & Authorization

- **Public routes** (`/resources`, `/api/resources`): No authentication required, only published resources visible
- **Admin routes** (`/admin/resources`, `/api/admin/*`): Requires `session.user.role === "ADMIN"`
- **File uploads**: Use service role key to bypass RLS (admin-only operation)

### File Upload Security

1. **Type validation**: Strict MIME type checking
2. **Size limits**: 50MB hard limit
3. **Filename sanitization**: Non-alphanumeric characters replaced with `_`
4. **Unique filenames**: Timestamp + random string prevents collisions
5. **Storage isolation**: Files stored in dedicated bucket
6. **Public URLs**: Only published resources are visible to non-admins

### Input Validation

- **Zod schemas**: Validate all API inputs
- **URL validation**: Ensures valid URLs for LINK/VIDEO types
- **Tag sanitization**: Trim whitespace, filter empty strings
- **SQL injection**: Protected by Prisma parameterized queries
- **XSS**: React auto-escapes all rendered content

## Future Enhancements

Potential features to add:

- [ ] YouTube video embed support (currently just links)
- [ ] Resource versioning (track file updates)
- [ ] Download analytics (track resource usage)
- [ ] Bulk upload functionality
- [ ] Resource expiration dates
- [ ] Permission levels (admin-only resources)
- [ ] Folder/subcategory organization
- [ ] Resource comments/feedback
- [ ] Favorite/bookmark resources
- [ ] Email notifications for new resources

## Dependencies

```json
{
  "@supabase/supabase-js": "^2.x",
  "@prisma/client": "^6.x",
  "react-hook-form": "^7.x",
  "@hookform/resolvers": "^3.x",
  "zod": "^3.x",
  "sonner": "^1.x",
  "lucide-react": "^0.x"
}
```

## Troubleshooting

### "Bucket not found" Error

**Problem**: Storage bucket name mismatch
**Solution**: Verify `STORAGE_BUCKET` in `/src/lib/storage.ts` matches your Supabase bucket name exactly

### "Signature verification failed"

**Problem**: Service role key is from wrong Supabase project
**Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` matches the same project as `NEXT_PUBLIC_SUPABASE_URL`

### "Row-level security policy violation"

**Problem**: Using anon key instead of service role for uploads
**Solution**: Verify `uploadFile()` in `/src/lib/storage.ts` uses `getSupabaseAdmin()` not regular `supabase` client

### Filters Not Working

**Problem**: Select components receiving empty string values
**Solution**: Use `"all"` as default value instead of empty string for Select components

### File Upload Fails Silently

**Problem**: Missing environment variables
**Solution**: Verify all Supabase env vars are set in `.env.local` and restart dev server

## Testing

### Manual Testing Checklist

**Admin Functionality**:
- [ ] Upload PDF resource
- [ ] Upload image resource
- [ ] Upload document resource
- [ ] Add link resource
- [ ] Add video resource
- [ ] Edit resource metadata
- [ ] Replace resource file
- [ ] Toggle publish/unpublish
- [ ] Delete resource
- [ ] Verify file deleted from Supabase Storage

**Public Functionality**:
- [ ] View published resources
- [ ] Search resources by title
- [ ] Filter by category
- [ ] Filter by type
- [ ] Filter by tags (single)
- [ ] Filter by multiple tags
- [ ] Clear all filters
- [ ] Download PDF
- [ ] View image
- [ ] Open external link

### E2E Testing

Example Playwright test structure:

```typescript
test("admin can upload and delete resource", async ({ page }) => {
  await page.goto("/admin/resources");
  await page.getByTestId("upload-resource-button").click();

  // Fill form and upload
  await page.getByLabel("Resource Type").selectOption("PDF");
  await page.getByLabel("Title").fill("Test Document");
  await page.getByLabel("Category").selectOption("TRAINING");

  const fileInput = page.getByLabel("Upload File");
  await fileInput.setInputFiles("test-file.pdf");

  await page.getByRole("button", { name: "Upload Resource" }).click();

  // Verify upload
  await expect(page.getByText("Resource uploaded successfully")).toBeVisible();
  await expect(page.getByText("Test Document")).toBeVisible();

  // Delete resource
  await page.getByTestId("resource-actions-menu").click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("Resource deleted successfully")).toBeVisible();
});
```
