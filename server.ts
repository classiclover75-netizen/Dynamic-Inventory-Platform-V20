import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import crypto from 'crypto';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import unzipper from 'unzipper';
import multer from 'multer';

const upload = multer({ dest: 'temp_uploads/' });

const app = express();
const PORT = 3000;

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'tiff', 'svg', 'heic'];

function deleteImageFile(filename: string) {
  try {
    const originalPath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }
    const thumbFilename = `thumb_${filename}`;
    const thumbPath = path.join(UPLOADS_DIR, thumbFilename);
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
  } catch (err) {
    console.error(`Failed to delete image file ${filename}:`, err);
  }
}

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.get('/uploads/thumb/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params;
    const originalPath = path.join(UPLOADS_DIR, filename);
    const thumbFilename = `thumb_${filename}`;
    const thumbPath = path.join(UPLOADS_DIR, thumbFilename);

    if (!fs.existsSync(originalPath)) {
      return res.status(404).send('Not found');
    }

    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');

    if (fs.existsSync(thumbPath)) {
      return res.sendFile(thumbPath);
    }

    try {
      await sharp(originalPath)
        .resize({ width: 150, height: 150, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toFile(thumbPath);
      return res.sendFile(thumbPath);
    } catch (sharpErr) {
      console.error('Thumbnail generation failed, serving original:', sharpErr);
      return res.sendFile(originalPath);
    }
  } catch (err) {
    next(err);
  }
});

app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res, path, stat) => {
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');
  }
}));

// MongoDB Connection with Retry
let isUsingMongoDB = false;

const connectDB = async () => {
  // 1. Clean the URI (remove extra quotes or spaces)
  let rawUri = process.env.MONGODB_URI;
  if (rawUri) {
    rawUri = rawUri.replace(/^["']|["']$/g, '').trim();
  }

  // 2. Determine final URI
  const uri = rawUri || (process.env.NODE_ENV === 'production' ? 'mongodb://db:27017/inventory' : '');

  // 3. Fallback check for AI Studio / Local Preview
  if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
    console.warn('No valid MONGODB_URI found (Invalid scheme or empty). Using local file storage fallback for preview.');
    return;
  }

  // 4. Connection Loop
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log('Connected to MongoDB');
      isUsingMongoDB = true;
      await syncDatabaseParity();
      return;
    } catch (err: any) {
      retries++;
      console.error(`MongoDB connection attempt ${retries} failed. ${err.message}`);
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  console.warn('Could not connect to MongoDB after retries. Falling back to local file storage for preview.');
};
connectDB();

// Local Storage Fallback Logic
const LOCAL_DB_PATH = path.join(process.cwd(), 'db.json');

async function getLocalDB() {
  try {
    const data = await fs.promises.readFile(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { pages: [], settings: {} };
  }
}

async function saveLocalDB(data: any) {
  const tmpPath = `${LOCAL_DB_PATH}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.promises.rename(tmpPath, LOCAL_DB_PATH);
}

async function syncDatabaseParity() {
  try {
    const mongoPageCount = await Page.countDocuments();
    const localExists = fs.existsSync(LOCAL_DB_PATH);
    let localData = { pages: [], settings: {} } as any;
    if (localExists) {
      try {
        const raw = await fs.promises.readFile(LOCAL_DB_PATH, 'utf-8');
        localData = JSON.parse(raw);
      } catch (e) {
        // ignore
      }
    }

    if (mongoPageCount === 0 && localData.pages && localData.pages.length > 0) {
      console.log('MongoDB is empty but local db.json has pages. Syncing local to MongoDB...');
      for (const localPage of localData.pages) {
        await Page.create({ name: localPage.name, config: localPage.config || {} });
        const rowsToInsert = (localPage.rows || []).map((row: any) => ({
          pageName: localPage.name,
          data: row
        }));
        if (rowsToInsert.length > 0) {
          await PageRow.insertMany(rowsToInsert);
        }
      }
      
      if (localData.settings) {
        await AppSettings.findOneAndUpdate({}, {
          globalCopyBoxes: localData.settings.globalCopyBoxes,
          globalRowNoWidth: localData.settings.globalRowNoWidth,
          maxSearchHistory: localData.settings.maxSearchHistory
        }, { upsert: true });
      }
      console.log('Local to MongoDB sync complete.');
    } else if (mongoPageCount > 0) {
      console.log('MongoDB has data. Writing/updating a backup copy to local db.json to maintain consistency...');
      const pages = await Page.find({});
      const pageRows = await getSortedPageRows({});
      const settings = await AppSettings.findOne({});
      
      const localPagesList = [];
      for (const page of pages) {
        const rowsForPage = pageRows.filter(r => r.pageName === page.name).map(r => r.data);
        localPagesList.push({
          name: page.name,
          config: page.config,
          rows: rowsForPage
        });
      }
      
      const newLocalDb = {
        pages: localPagesList,
        settings: settings ? {
          globalCopyBoxes: settings.globalCopyBoxes,
          globalRowNoWidth: settings.globalRowNoWidth,
          maxSearchHistory: settings.maxSearchHistory
        } : {}
      };
      await fs.promises.writeFile(LOCAL_DB_PATH, JSON.stringify(newLocalDb, null, 2));
      console.log('MongoDB to local db.json backup complete.');
    }
  } catch (err) {
    console.error('Failed to run database parity sync:', err);
  }
}

let localBackupTimeout: NodeJS.Timeout | null = null;
let isBackupRunning = false;
let pendingBackup = false;

async function performLocalBackup() {
  if (!isUsingMongoDB) return;
  if (isBackupRunning) {
    pendingBackup = true;
    return;
  }
  isBackupRunning = true;
  try {
    const pages = await Page.find({});
    const pageRows = await getSortedPageRows({});
    const settings = await AppSettings.findOne({});
    
    const localPagesList = [];
    for (const page of pages) {
      const rowsForPage = pageRows.filter(r => r.pageName === page.name).map(r => r.data);
      localPagesList.push({
        name: page.name,
        config: page.config,
        rows: rowsForPage
      });
    }
    
    const newLocalDb = {
      pages: localPagesList,
      settings: settings ? {
        globalCopyBoxes: settings.globalCopyBoxes,
        globalRowNoWidth: settings.globalRowNoWidth,
        maxSearchHistory: settings.maxSearchHistory
      } : {}
    };
    await fs.promises.writeFile(LOCAL_DB_PATH, JSON.stringify(newLocalDb, null, 2));
  } catch (err) {
    console.error('Failed to update local db.json backup:', err);
  } finally {
    isBackupRunning = false;
    if (pendingBackup) {
      pendingBackup = false;
      triggerLocalBackup(0);
    }
  }
}

function triggerLocalBackup(delayMs = 3000): Promise<void> {
  if (!isUsingMongoDB) return Promise.resolve();
  if (localBackupTimeout) {
    clearTimeout(localBackupTimeout);
  }
  localBackupTimeout = setTimeout(() => {
    localBackupTimeout = null;
    performLocalBackup();
  }, delayMs);
  return Promise.resolve();
}

// Image Helpers
async function processRowImages(row: any, forceSave = false, providedCache?: Map<string, Promise<string>>) {
  const newRow = { ...row };
  const writePromises: Promise<void>[] = [];
  const safeId = row.id ? String(row.id).replace(/[^a-zA-Z0-9_\-]/g, '') : uuidv4();

  for (const key in newRow) {
    if (key === 'id') continue;
    const value = newRow[key];
    let imgVal = value;
    const isObject = typeof value === 'object' && value !== null && typeof value.data === 'string';
    if (isObject) {
      imgVal = value.data;
    }

    if (typeof imgVal === 'string') {
      // The value is already a local filename reference or regular text.
      // DO NOT re-process, DO NOT rename, DO NOT check if it matches row.id.
      // Allow multiple rows to share this exact filename.
      if (!imgVal.startsWith('http') && !imgVal.startsWith('data:') && !imgVal.startsWith('blob:')) {
        continue;
      }

      let isImage = false;
      let shouldProcess = false;

      if (/^https?:\/\//i.test(imgVal)) {
        isImage = true;
        if (imgVal.includes('/uploads/')) {
          const matchedFilename = imgVal.split('/uploads/').pop()?.split('?')[0];
          // If it's a URL to local uploads and the file exists, leave it as is
          if (matchedFilename && fs.existsSync(path.join(UPLOADS_DIR, matchedFilename))) {
            newRow[key] = isObject ? { ...value, data: matchedFilename } : matchedFilename;
            continue;
          } else {
             shouldProcess = true;
          }
        } else {
          shouldProcess = true;
        }
      } else if (imgVal.startsWith('data:image/')) {
        isImage = true;
        shouldProcess = true;
      }

      if (isImage && shouldProcess) {
        let cacheKey = imgVal;
        if (imgVal.startsWith('data:image/')) {
          cacheKey = crypto.createHash('md5').update(imgVal).digest('hex');
        }

        let processPromise: Promise<string>;
        if (providedCache && providedCache.has(cacheKey)) {
          processPromise = providedCache.get(cacheKey)!;
        } else {
          processPromise = (async () => {
            let buffer: Buffer | null = null;
          let ext = 'jpg';

          if (imgVal.startsWith('data:image/')) {
            const parts = imgVal.split(';base64,');
            const mimeType = parts[0].replace('data:image/', '');
            ext = mimeType.split('+')[0];
            if (ext === 'jpeg') ext = 'jpg';
            if (!ext) ext = 'png';
            buffer = Buffer.from(parts[1], 'base64');
          } else if (/^[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|webp|gif|avif|tiff)$/i.test(imgVal)) {
            buffer = await fs.promises.readFile(path.join(UPLOADS_DIR, imgVal));
            ext = imgVal.split('.').pop() || 'jpg';
          } else if (/^https?:\/\//i.test(imgVal)) {
            const response = await fetch(imgVal);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
            const contentType = response.headers.get('content-type');
            if (contentType) {
               if (contentType.includes('png')) ext = 'png';
               else if (contentType.includes('gif')) ext = 'gif';
               else if (contentType.includes('webp')) ext = 'webp';
            }
          }

          if (!buffer) throw new Error('Could not resolve image buffer');

          let skipSharp = false;
          if (buffer.byteLength <= 100 * 1024 && forceSave) skipSharp = true;

          if (!skipSharp) {
            try {
              const metadata = await sharp(buffer).metadata();
              if (buffer.byteLength > 300 * 1024 || (metadata.width && metadata.width > 1200) || (metadata.height && metadata.height > 1200)) {
                buffer = await sharp(buffer)
                  .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
                  .jpeg({ quality: 80 })
                  .toBuffer();
                ext = 'jpg';
              }
            } catch (sharpError) {
              if (!forceSave) throw new Error('SHARP_UNSUPPORTED_FORMAT');
              console.error("Sharp error", sharpError);
            }
          }

          const filename = `${safeId}_${uuidv4().substring(0,8)}.${ext}`;
          const filepath = path.join(UPLOADS_DIR, filename);
          await fs.promises.writeFile(filepath, buffer);
          
          try {
            const thumbFilename = `thumb_${filename}`;
            const thumbPath = path.join(UPLOADS_DIR, thumbFilename);
            await sharp(buffer)
              .resize({ width: 150, height: 150, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 70 })
              .toFile(thumbPath);
          } catch (e) {
            console.error("Failed to generate thumb on upload:", e);
          }
          
          return filename;
        })();

          if (providedCache) {
            providedCache.set(cacheKey, processPromise);
          }
        }

        writePromises.push((async () => {
          try {
            const filename = await processPromise;
            newRow[key] = isObject ? { ...value, data: filename } : filename;
          } catch (err: any) {
            throw new Error(`Failed to process image for column "${key}": ${err.message}`);
          }
        })());
      }
    }
  }
  await Promise.all(writePromises);
  return newRow;
}

async function processRowsConcurrently(rows: any[], limit = 50, forceSave = false, providedCache?: Map<string, Promise<string>>) {
  const imageProcessingCache = providedCache || new Map<string, Promise<string>>();
  const results = [];
  for (let i = 0; i < rows.length; i += limit) {
    const chunk = rows.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(r => processRowImages(r, forceSave, imageProcessingCache)));
    results.push(...chunkResults);
    // Yield to event loop to avoid blocking during large batches
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return results;
}

async function cleanupOrphanImages(oldRows: any[], newRows: any[], skipDbCheck = false, excludePageName?: string) {
  const oldFiles = new Set<string>();
  const newFiles = new Set<string>();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

  const extractFiles = (rows: any[], set: Set<string>) => {
    rows.forEach(row => {
      Object.values(row).forEach(value => {
        let val = value;
        if (typeof value === 'object' && value !== null && typeof (value as any).data === 'string') {
          val = (value as any).data;
        }
        if (typeof val === 'string') {
          if (val.includes('/uploads/')) {
            val = val.split('/uploads/').pop() || val;
          }
          const strVal = val as string;
          if (imageExtensions.some(ext => strVal.toLowerCase().endsWith(ext)) && !/^https?:\/\//i.test(strVal)) {
            set.add(strVal);
          }
        }
      });
    });
  };

  extractFiles(oldRows, oldFiles);
  extractFiles(newRows, newFiles);

  const candidates = new Set<string>();
  oldFiles.forEach(file => {
    if (!newFiles.has(file)) {
      candidates.add(file);
    }
  });

  if (candidates.size === 0) return;

  const oldRowIds = new Set(oldRows.map(r => String(r.id)));

  if (!skipDbCheck) {
    const processRows = (rows: any[]) => {
      for (const row of rows) {
        const tempSet = new Set<string>();
        extractFiles([row], tempSet);
        for (const file of candidates) {
          if (tempSet.has(file)) {
            candidates.delete(file);
          }
        }
        if (candidates.size === 0) return true;
      }
      return false;
    };

    if (isUsingMongoDB) {
      if (excludePageName) {
        const remainingRecords = await getSortedPageRows({ pageName: { $ne: excludePageName } });
        processRows(remainingRecords.map((r: any) => r.data));
      } else {
        const allRecords = await getSortedPageRows({});
        const remainingRecords = allRecords.filter((r: any) => !oldRowIds.has(String(r.data.id)));
        processRows(remainingRecords.map((r: any) => r.data));
      }
    } else {
      const db = await getLocalDB();
      for (const p of db.pages) {
        if (excludePageName && p.name === excludePageName) continue;
        if (p.rows) {
          const remainingRows = excludePageName ? p.rows : p.rows.filter((r: any) => !oldRowIds.has(String(r.id)));
          if (processRows(remainingRows)) break;
        }
      }
    }
  }

  candidates.forEach(file => {
    deleteImageFile(file);
  });
}

async function diskSweepOrphans(allNewRows: any[]) {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  
  const keepSet = new Set<string>();

  const extractFiles = (rows: any[], set: Set<string>) => {
    rows.forEach(row => {
      Object.values(row).forEach(value => {
        let val = value;
        if (typeof value === 'object' && value !== null && typeof (value as any).data === 'string') {
          val = (value as any).data;
        }
        if (typeof val === 'string') {
          if (val.includes('/uploads/')) {
            val = val.split('/uploads/').pop() || val;
          }
          let strVal = val as string;
          strVal = strVal.split('?')[0]; // Remove cache busters if any
          const ext = strVal.split('.').pop()?.toLowerCase() || '';
          if (ALLOWED_IMAGE_EXTENSIONS.includes(ext) && !/^https?:\/\//i.test(strVal)) {
            set.add(strVal);
          }
        }
      });
    });
  };

  extractFiles(allNewRows, keepSet);

  try {
    const filesOnDisk = fs.readdirSync(UPLOADS_DIR);
    for (const file of filesOnDisk) {
      if (file === '.gitkeep' || file === 'dummy.txt') continue;
      
      const ext = file.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext) && ext !== 'blob') {
         continue; 
      }

      let originalName = file;
      if (file.startsWith('thumb_')) {
         originalName = file.substring(6);
      }

      if (!keepSet.has(originalName)) {
        deleteImageFile(originalName);
      }
    }
  } catch (err) {
    console.error("diskSweepOrphans failed:", err);
  }
}

// Mongoose Schema
const pageSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  config: { type: mongoose.Schema.Types.Mixed, default: {} }
});
pageSchema.index({ name: 1 });
const Page = mongoose.model('Page', pageSchema);

const pageRowSchema = new mongoose.Schema({
  pageName: { type: String, required: true },
  order: { type: Number, default: () => Date.now() },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
});
pageRowSchema.index({ pageName: 1, order: 1, 'data.id': 1 });
pageRowSchema.index({ pageName: 1, 'data.id': 1 });
pageRowSchema.index({ 'data.id': 1 });
const PageRow = mongoose.model('PageRow', pageRowSchema);

// Helper function to safely get rows sorted, and perform one-time order migration if needed.
async function getSortedPageRows(query: any = {}) {
  const rows = await PageRow.find(query).sort({ pageName: 1, order: 1, _id: 1 }).lean();
  
  const pagesToMigrate = new Set<string>();
  rows.forEach((r: any) => {
    if (typeof r.order !== 'number') {
      pagesToMigrate.add(r.pageName);
    }
  });

  if (pagesToMigrate.size > 0) {
    const bulkOps: any[] = [];
    const pageGroups = new Map<string, any[]>();
    
    rows.forEach((r: any) => {
      if (!pageGroups.has(r.pageName)) pageGroups.set(r.pageName, []);
      pageGroups.get(r.pageName)!.push(r);
    });
    
    for (const pageName of pagesToMigrate) {
      const groupRows = pageGroups.get(pageName)!;
      groupRows.forEach((r, index) => {
        r.order = index;
        bulkOps.push({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { order: index } }
          }
        });
      });
    }
    
    if (bulkOps.length > 0) {
      try {
        await PageRow.bulkWrite(bulkOps);
        console.log(`Migrated order field for ${bulkOps.length} rows in pages: ${Array.from(pagesToMigrate).join(', ')}`);
      } catch (e) {
        console.error("Migration bulkWrite failed:", e);
      }
    }
  }
  
  return rows;
}


const settingsSchema = new mongoose.Schema({
  globalCopyBoxes: mongoose.Schema.Types.Mixed,
  globalRowNoWidth: Number,
  maxSearchHistory: { type: Number, default: 10 },
  pageOrder: [String]
});
const AppSettings = mongoose.model('AppSettings', settingsSchema);

// API Routes
function embedImagesInRows(rows: any[]) {
  return rows.map(row => {
    const newRow = { ...row };
    for (const key in newRow) {
      let val = newRow[key];
      let isObject = false;
      if (typeof val === 'object' && val !== null && typeof val.data === 'string') {
        val = val.data;
        isObject = true;
      }

      if (typeof val === 'string') {
        let filename = val;
        let shouldEmbed = false;

        if (filename.includes('/uploads/')) {
          filename = filename.split('/uploads/').pop() || filename;
          filename = filename.split('?')[0]; // remove query string
          shouldEmbed = true;
        } else if (!/^https?:\/\//i.test(filename)) {
          shouldEmbed = true;
        }
        
        if (shouldEmbed && /\.(png|jpe?g|gif|webp|avif|tiff)$/i.test(filename)) {
          try {
            const filepath = path.join(UPLOADS_DIR, filename);
            if (fs.existsSync(filepath)) {
              const ext = path.extname(filename).substring(1).toLowerCase();
              const mimeType = ext === 'jpg' ? 'jpeg' : ext;
              const fileData = fs.readFileSync(filepath, { encoding: 'base64' });
              const result = `data:image/${mimeType};base64,${fileData}`;
              newRow[key] = isObject ? { ...newRow[key], data: result } : result;
            } else {
              newRow[key] = isObject ? { ...newRow[key], data: val } : val;
            }
          } catch (e) {
            console.error(`Failed to convert image ${val} to base64:`, e);
            newRow[key] = isObject ? { ...newRow[key], data: val } : val;
          }
        } else {
           newRow[key] = isObject ? { ...newRow[key], data: val } : val;
        }
      }
    }
    return newRow;
  });
}

const getFormattedDate = () => {
  const now = new Date();
  const day = now.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[now.getMonth()];
  const year = now.getFullYear();

  // Output format: "4-May-2026"
  return `${day}-${month}-${year}`;
};

app.post('/api/upload-excel-images', upload.array('images', 2000), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const uploadedPaths: string[] = [];
    const safeId = String(req.body.safeId || 'excel').replace(/[^a-zA-Z0-9_\-]/g, '');

    // First validate ALL files' extensions
    for (const file of files) {
      let ext = (file.originalname.split('.').pop() || 'png').toLowerCase();
      if (ext === 'blob') ext = 'png';
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        // Cleanup temp files
        for (const f of files) {
          if (fs.existsSync(f.path)) {
            try { fs.unlinkSync(f.path); } catch (e) {}
          }
        }
        return res.status(400).json({ error: `Rejected: File "${file.originalname}" is not an allowed image format.` });
      }
    }

    // Now process validated files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let ext = (file.originalname.split('.').pop() || 'png').toLowerCase();
      if (ext === 'blob') ext = 'png';
      const filename = `${safeId}_${uuidv4().substring(0,8)}.${ext}`;
      const filepath = path.join(UPLOADS_DIR, filename);

      await fs.promises.rename(file.path, filepath);
      uploadedPaths.push(filename);
    }

    res.json({ success: true, paths: uploadedPaths });
  } catch (err: any) {
    console.error('Failed to upload excel images:', err);
    res.status(500).json({ error: err.message || 'Failed to upload images' });
  }
});

app.post('/api/upload-excel-media-bulk', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const safeId = String(req.body.safeId || 'excel').replace(/[^a-zA-Z0-9_\-]/g, '');
    const mediaMap: Record<string, string> = {};

    const directory = await unzipper.Open.file(req.file.path);
    for (const file of directory.files) {
      if (file.path.startsWith('xl/media/') && file.type === 'File') {
         let ext = (file.path.split('.').pop() || 'png').toLowerCase();
         if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
           continue; // Skip non-images
         }
         const filename = `${safeId}_${uuidv4().substring(0,8)}.${ext}`;
         const filepath = path.join(UPLOADS_DIR, filename);
         
         mediaMap[file.path] = filename;
         const buffer = await file.buffer();
         await fs.promises.writeFile(filepath, buffer);
      }
    }
    
    // Cleanup the uploaded temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({ success: true, mediaMap });
  } catch (err: any) {
    console.error('Failed to extract media bulk:', err);
    res.status(500).json({ error: err.message || 'Failed to extract media' });
  }
});

app.post('/api/admin/migrate-images', async (_req, res) => {
  try {
    let migratedCount = 0;
    const brokenImages: any[] = [];
    
    const migrateRow = async (row: any, pageName: string) => {
      let imageMigratedCount = 0;
      const newRow = { ...row };
      const rowPromises: Promise<void>[] = [];
      
      for (const key in newRow) {
        let val = newRow[key];
        let isObject = false;
        if (typeof val === 'object' && val !== null && typeof val.data === 'string') {
          val = val.data;
          isObject = true;
        }

        if (typeof val === 'string') {
          if (/^https?:\/\//i.test(val)) {
            if (val.includes('/uploads/')) {
              let filename = val.split('/uploads/').pop() || val;
              filename = filename.split('?')[0];
              newRow[key] = isObject ? { ...newRow[key], data: filename } : filename;
              imageMigratedCount++;
              
              if (!fs.existsSync(path.join(UPLOADS_DIR, filename))) {
                brokenImages.push({ page: pageName, rowId: row.id, column: key, filename });
              }
            } else {
              rowPromises.push((async () => {
                const dummyRow = { [key]: newRow[key] };
                try {
                  const processed = await processRowImages(dummyRow, true);
                  if (processed[key] !== newRow[key]) {
                     newRow[key] = processed[key];
                     imageMigratedCount++;
                  }
                } catch (e) {
                  console.error("Migration error for external URL:", e);
                }
              })());
            }
          } else if (!val.startsWith('data:') && /\.(png|jpe?g|gif|webp|avif|tiff)$/i.test(val)) {
            if (!fs.existsSync(path.join(UPLOADS_DIR, val))) {
              brokenImages.push({ page: pageName, rowId: row.id, column: key, filename: val });
            }
          }
        }
      }
      await Promise.all(rowPromises);
      return { newRow, imageMigratedCount };
    };

    const migrateRowsConcurrently = async (rows: any[], pageName: string) => {
       const mapped = [];
       for (let i = 0; i < rows.length; i += 50) {
         const chunk = rows.slice(i, i + 50);
         const chunkResults = await Promise.all(chunk.map(r => migrateRow(r, pageName)));
         mapped.push(...chunkResults);
       }
       return mapped;
    };

    if (isUsingMongoDB) {
      const oldPageRows = await getSortedPageRows({});
      const pagesMap = new Map<string, any[]>();
      
      for (const pr of oldPageRows) {
        if (!pagesMap.has(pr.pageName)) pagesMap.set(pr.pageName, []);
        pagesMap.get(pr.pageName)!.push(pr.data);
      }
      
      for (const [pageName, rows] of pagesMap.entries()) {
        const results = await migrateRowsConcurrently(rows, pageName);
        const newRows = results.map((r: any) => r.newRow);
        const thisPageMigratedCount = results.reduce((sum: number, r: any) => sum + r.imageMigratedCount, 0);
        
        if (thisPageMigratedCount > 0) {
          migratedCount += thisPageMigratedCount;
          await cleanupOrphanImages(rows, newRows);
          await PageRow.deleteMany({ pageName });
          await PageRow.insertMany(newRows.map((r: any) => ({ pageName, data: r })));
        }
      }
    } else {
      const db = await getLocalDB();
      for (const page of db.pages) {
        if (!page.rows || page.rows.length === 0) continue;
        const results = await migrateRowsConcurrently(page.rows, page.name);
        const newRows = results.map((r: any) => r.newRow);
        const thisPageMigratedCount = results.reduce((sum: number, r: any) => sum + r.imageMigratedCount, 0);
        
        if (thisPageMigratedCount > 0) {
          migratedCount += thisPageMigratedCount;
          await cleanupOrphanImages(page.rows, newRows);
          page.rows = newRows;
        }
      }
      if (migratedCount > 0) {
        await saveLocalDB(db);
      }
    }

    res.json({ success: true, count: migratedCount, brokenImages });
  } catch (err: any) {
    console.error("Migration failed:", err);
    res.status(500).json({ error: 'Migration failed' });
  }
});

app.get('/api/export/page/:name(*)', async (req, res) => {
  try {
    const { name } = req.params;
    let pageData: any = null;

    if (isUsingMongoDB) {
      const page = await Page.findOne({ name });
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }
      const oldPageRows = await getSortedPageRows({ pageName: name });
      const rows = oldPageRows.map((r: any) => r.data);
      
      pageData = {
        name: page.name,
        config: page.config,
        rows: embedImagesInRows(rows)
      };
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }
      pageData = {
        name: page.name,
        config: page.config,
        rows: embedImagesInRows(page.rows || [])
      };
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${name}_backup_${Date.now()}.json"`);
    res.send(JSON.stringify(pageData, null, 2));

  } catch (err) {
    console.error("Export page failed:", err);
    res.status(500).json({ error: 'Failed to export page' });
  }
});

app.get('/api/export', async (_req, res) => {
  try {
    let state: any = {};
    if (isUsingMongoDB) {
      const pages = await Page.find({});
      const rows = await getSortedPageRows({});
      const settings: any = await AppSettings.findOne() || {};
      
      const pageConfigs: Record<string, any> = {};
      const pageRows: Record<string, any[]> = {};
      
      pages.forEach(p => {
        pageConfigs[p.name] = p.config;
      });
      
      rows.forEach(r => {
        if (!pageRows[r.pageName]) pageRows[r.pageName] = [];
        pageRows[r.pageName].push(r.data);
      });

      // Embed images
      for (const pageName in pageRows) {
        pageRows[pageName] = embedImagesInRows(pageRows[pageName]);
      }
      
      state = {
        pages: pages.map(p => p.name),
        activePage: pages.length > 0 ? pages[0].name : '',
        pageConfigs,
        pageRows,
        globalCopyBoxes: settings.globalCopyBoxes,
        globalRowNoWidth: settings.globalRowNoWidth,
        maxSearchHistory: settings.maxSearchHistory
      };
    } else {
      state = await getLocalDB();
      if (state.pages) {
        state.pages = state.pages.map((page: any) => ({
          ...page,
          rows: embedImagesInRows(page.rows || [])
        }));
      }
    }

    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=inventory_backup_${formattedDate}.json`);
    res.send(JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.get('/api/export-zip', async (_req, res) => {
  try {
    let state: any = {};
    if (isUsingMongoDB) {
      const pages = await Page.find({});
      const rows = await getSortedPageRows({});
      const settings: any = await AppSettings.findOne() || {};
      
      const pageConfigs: Record<string, any> = {};
      const pageRows: Record<string, any[]> = {};
      
      pages.forEach(p => {
        pageConfigs[p.name] = p.config;
      });
      
      rows.forEach(r => {
        if (!pageRows[r.pageName]) pageRows[r.pageName] = [];
        pageRows[r.pageName].push(r.data);
      });

      // DO NOT EMBED IMAGES. DONT PASS THROUGH embedImagesInRows.
      
      state = {
        pages: pages.map(p => p.name),
        activePage: pages.length > 0 ? pages[0].name : '',
        pageConfigs,
        pageRows,
        globalCopyBoxes: settings.globalCopyBoxes,
        globalRowNoWidth: settings.globalRowNoWidth,
        maxSearchHistory: settings.maxSearchHistory
      };
    } else {
      state = await getLocalDB();
      // DO NOT EMBED IMAGES.
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=Full_Backup_Unverified_${getFormattedDate()}.zip`);
    
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    archive.on('error', function(err) {
      throw err;
    });

    archive.pipe(res);

    archive.append(JSON.stringify(state, null, 2), { name: 'data.json' });
    archive.directory(UPLOADS_DIR, 'uploads');

    await archive.finalize();
  } catch (err) {
    console.error('Export zip error:', err);
    res.status(500).json({ error: 'Failed to export data as zip' });
  }
});

app.get('/api/export-zip-verified', async (_req, res) => {
  let tempFilePath = '';
  try {
    function getDirSize(dirPath: string): number {
      let size = 0;
      if (!fs.existsSync(dirPath)) return 0;
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) size += stats.size;
        else if (stats.isDirectory()) size += getDirSize(filePath);
      }
      return size;
    }
    const dirSize = getDirSize(UPLOADS_DIR);
    const estimate = dirSize + 50 * 1024 * 1024; // 50MB margin

    try {
      const statfs = fs.statfsSync(UPLOADS_DIR);
      const freeSpace = statfs.bfree * statfs.bsize;
      if (freeSpace < estimate * 1.2) {
        return res.status(507).json({ error: "Not enough disk space for verified export. Use Direct Export instead." });
      }
    } catch (e) {
      // Ignored if statfsSync fails
    }

    const tempDir = path.join(process.cwd(), 'temp_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    tempFilePath = path.join(tempDir, `verified_export_${Date.now()}_${Math.random().toString(36).substring(7)}.zip`);

    let state: any = {};
    if (isUsingMongoDB) {
      const pages = await Page.find({});
      const rows = await getSortedPageRows({});
      const settings: any = await AppSettings.findOne() || {};
      
      const pageConfigs: Record<string, any> = {};
      const pageRows: Record<string, any[]> = {};
      
      pages.forEach(p => {
        pageConfigs[p.name] = p.config;
      });
      
      rows.forEach(r => {
        if (!pageRows[r.pageName]) pageRows[r.pageName] = [];
        pageRows[r.pageName].push(r.data);
      });
      
      state = {
        pages: pages.map(p => p.name),
        activePage: pages.length > 0 ? pages[0].name : '',
        pageConfigs,
        pageRows,
        globalCopyBoxes: settings.globalCopyBoxes,
        globalRowNoWidth: settings.globalRowNoWidth,
        maxSearchHistory: settings.maxSearchHistory
      };
    } else {
      state = await getLocalDB();
    }

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(tempFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      output.on('error', (err: any) => {
        if (err.code === 'ENOSPC') reject(new Error('ENOSPC'));
        else reject(err);
      });
      
      archive.pipe(output);
      archive.append(JSON.stringify(state, null, 2), { name: 'data.json' });
      if (fs.existsSync(UPLOADS_DIR)) {
        archive.directory(UPLOADS_DIR, 'uploads');
      }
      archive.finalize();
    });

    const zip = new AdmZip(tempFilePath);
    const zipEntries = zip.getEntries();
    
    const dataEntry = zipEntries.find((e: any) => e.entryName === 'data.json');
    if (!dataEntry) throw new Error("Missing data.json in zip");
    
    let parsedData: any;
    try {
      parsedData = JSON.parse(dataEntry.getData().toString('utf8'));
    } catch (e) {
      throw new Error("data.json is not valid JSON");
    }

    const pagesCount = parsedData.pages ? parsedData.pages.length : 0;
    const livePagesCount = state.pages ? state.pages.length : 0;
    if (pagesCount !== livePagesCount) throw new Error(`Page count mismatch`);

    let parsedRowCount = 0;
    if (parsedData.pageRows) {
      Object.values(parsedData.pageRows).forEach((arr: any) => parsedRowCount += arr.length);
    }
    let liveRowCount = 0;
    if (state.pageRows) {
      Object.values(state.pageRows).forEach((arr: any) => liveRowCount += arr.length);
    }
    if (parsedRowCount !== liveRowCount) throw new Error(`Row count mismatch`);

    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.tiff', '.svg', '.heic'];
    const requiredImages = new Set<string>();
    
    const extractImages = (rows: any[]) => {
      rows.forEach(row => {
        Object.values(row).forEach(value => {
          let val = value;
          if (typeof value === 'object' && value !== null && typeof (value as any).data === 'string') {
            val = (value as any).data;
          }
          if (typeof val === 'string') {
            if (val.includes('/uploads/')) {
              val = val.split('/uploads/').pop() || val;
            }
            const strVal = val as string;
            if (imageExtensions.some(ext => strVal.toLowerCase().endsWith(ext)) && !/^https?:\/\//i.test(strVal)) {
              requiredImages.add(strVal);
            }
          }
        });
      });
    };
    
    if (parsedData.pageRows) {
      Object.values(parsedData.pageRows).forEach((arr: any) => extractImages(arr));
    }
    
    const zipUploads = new Set(zipEntries.map((e: any) => e.entryName));
    for (const img of requiredImages) {
      if (!zipUploads.has(`uploads/${img}`)) {
        throw new Error(`Missing image in zip: uploads/${img}`);
      }
    }

    const stats = fs.statSync(tempFilePath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=Full_Backup_verified_${getFormattedDate()}.zip`);
    res.setHeader('Content-Length', stats.size.toString());
    
    const readStream = fs.createReadStream(tempFilePath);
    readStream.pipe(res);
    
    readStream.on('close', () => {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    });
    readStream.on('error', (err) => {
      console.error('Error streaming verified zip:', err);
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    });

  } catch (err: any) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    console.error('Verified export zip error:', err);
    if (err.message === 'ENOSPC') {
      return res.status(507).json({ error: "Not enough disk space for verified export. Use Direct Export instead." });
    }
    const msg = err.message || 'Unknown error';
    if (msg.startsWith('Missing') || msg.startsWith('Page count') || msg.startsWith('Row count') || msg.startsWith('data.json')) {
      return res.status(500).json({ error: `Backup verification failed: ${msg}` });
    }
    res.status(500).json({ error: 'Failed to export verified data as zip' });
  }
});

app.get('/api/export-zip/page/:name(*)', async (req, res) => {
  try {
    const { name } = req.params;
    let pageData: any = null;

    if (isUsingMongoDB) {
      const page = await Page.findOne({ name });
      if (!page) return res.status(404).json({ error: 'Page not found' });
      const rows = await getSortedPageRows({ pageName: name });
      const linkedPages = await Page.find({ "config.linkedSourcePage": name });
      
      const pages = [name];
      const pageConfigs: any = { [name]: page.config || {} };
      const pageRows: any = { [name]: rows.map((r: any) => r.data) };

      for (const p of linkedPages) {
        pages.push(p.name);
        pageConfigs[p.name] = p.config || {};
        const pRows = await getSortedPageRows({ pageName: p.name });
        pageRows[p.name] = pRows.map((r: any) => r.data);
      }

      pageData = {
        isBundle: true,
        pages,
        pageConfigs,
        pageRows
      };
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (!page) return res.status(404).json({ error: 'Page not found' });
      
      const pages = [name];
      const pageConfigs: any = { [name]: page.config || {} };
      const pageRows: any = { [name]: page.rows || [] };

      db.pages.forEach((p: any) => {
        if (p.config && p.config.linkedSourcePage === name) {
          pages.push(p.name);
          pageConfigs[p.name] = p.config || {};
          pageRows[p.name] = p.rows || [];
        }
      });

      pageData = {
        isBundle: true,
        pages,
        pageConfigs,
        pageRows
      };
    }

    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.tiff', '.svg', '.heic'];
    const requiredImages = new Set<string>();
    
    const extractImages = (rows: any[]) => {
      rows.forEach(row => {
        Object.values(row).forEach(value => {
          let val = value;
          if (typeof value === 'object' && value !== null && typeof (value as any).data === 'string') {
            val = (value as any).data;
          }
          if (typeof val === 'string') {
            if (val.includes('/uploads/')) {
              val = val.split('/uploads/').pop() || val;
            }
            const strVal = val as string;
            if (imageExtensions.some(ext => strVal.toLowerCase().endsWith(ext)) && !/^https?:\/\//i.test(strVal)) {
              requiredImages.add(strVal);
            }
          }
        });
      });
    };

    if (pageData && pageData.pageRows) {
      Object.values(pageData.pageRows).forEach((rows: any) => extractImages(rows));
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=page_backup_${name}_${getFormattedDate()}.zip`);
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    archive.append(JSON.stringify(pageData, null, 2), { name: 'data.json' });
    
    for (const img of requiredImages) {
      const imgPath = path.join(UPLOADS_DIR, img);
      if (fs.existsSync(imgPath)) {
        archive.file(imgPath, { name: 'uploads/' + img });
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('Export page zip error:', err);
    res.status(500).json({ error: 'Failed to export page as zip' });
  }
});

app.get('/api/state', async (_req, res) => {
  try {
    if (isUsingMongoDB) {
      const pages = await Page.find({}, 'name');
      const settings: any = await AppSettings.findOne() || {};
      
      const pageNames = pages.map(p => p.name);
      if (settings.pageOrder && settings.pageOrder.length > 0) {
        pageNames.sort((a, b) => {
          const aIdx = settings.pageOrder.indexOf(a);
          const bIdx = settings.pageOrder.indexOf(b);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      }
      
      const state = {
        pages: pageNames,
        globalCopyBoxes: settings.globalCopyBoxes,
        globalRowNoWidth: settings.globalRowNoWidth,
        maxSearchHistory: settings.maxSearchHistory,
        pageOrder: settings.pageOrder || []
      };
      
      return res.json(state);
    } else {
      const db = await getLocalDB();
      const pageNames = db.pages.map((p: any) => p.name);
      const pageOrder = db.settings?.pageOrder || [];
      if (pageOrder && pageOrder.length > 0) {
        pageNames.sort((a: string, b: string) => {
          const aIdx = pageOrder.indexOf(a);
          const bIdx = pageOrder.indexOf(b);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      }
      
      const state = {
        pages: pageNames,
        globalCopyBoxes: db.settings?.globalCopyBoxes,
        globalRowNoWidth: db.settings?.globalRowNoWidth,
        maxSearchHistory: db.settings?.maxSearchHistory,
        pageOrder: pageOrder
      };
      return res.json(state);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch state' });
  }
});

app.get('/api/local-image-size', async (req, res) => {
  try {
    let filename = req.query.filename as string;
    if (!filename) {
      return res.json({ ok: false });
    }

    if (filename.includes('/uploads/')) {
      filename = filename.split('/uploads/').pop() || '';
    }
    filename = filename.split('?')[0];
    filename = path.basename(filename);

    if (filename.includes('/') || filename.includes('\\')) {
      return res.json({ ok: false });
    }

    const filepath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.json({ ok: false });
    }

    const stats = fs.statSync(filepath);
    return res.json({ ok: true, sizeBytes: stats.size });
  } catch (err) {
    return res.json({ ok: false });
  }
});

app.get('/api/pages/:name(*)', async (req, res) => {
  try {
    const { name } = req.params;
    if (isUsingMongoDB) {
      const page = await Page.findOne({ name });
      if (!page) return res.status(404).json({ error: 'Page not found' });
      
      const rows = await getSortedPageRows({ pageName: name });
      
      return res.json({
        name: page.name,
        config: page.config,
        rows: rows.map((r: any) => r.data)
      });
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (!page) return res.status(404).json({ error: 'Page not found' });
      
      return res.json({
        name: page.name,
        config: page.config,
        rows: page.rows || []
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch page data' });
  }
});

app.post('/api/pages', async (req, res) => {
  try {
    const { name, config } = req.body;
    if (isUsingMongoDB) {
      const newPage = new Page({ name, config });
      await newPage.save();
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      db.pages.push({ name, config, rows: [] });
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create page' });
  }
});

app.put('/api/pages/:name(*)/rename', async (req, res) => {
  try {
    const { name } = req.params;
    const { newName } = req.body;
    if (isUsingMongoDB) {
      await Page.findOneAndUpdate({ name }, { name: newName });
      await PageRow.updateMany({ pageName: name }, { pageName: newName });
      
      const linkedPages = await Page.find({ "config.linkedSourcePage": name });
      for (const p of linkedPages) {
        const newConfig = { ...(p.config || {}) };
        newConfig.linkedSourcePage = newName;
        await Page.findByIdAndUpdate(p._id, { config: newConfig });
      }
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (page) page.name = newName;
      
      db.pages.forEach((p: any) => {
        if (p.config && p.config.linkedSourcePage === name) {
          p.config.linkedSourcePage = newName;
        }
      });
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to rename page' });
  }
});

app.delete('/api/pages/:name(*)', async (req, res) => {
  try {
    const { name } = req.params;
    let deletedRows: any[] = [];
    if (isUsingMongoDB) {
      const pageRows = await getSortedPageRows({ pageName: name });
      deletedRows = pageRows.map((r: any) => r.data);
      await Page.findOneAndDelete({ name });
      await PageRow.deleteMany({ pageName: name });
      
      const linkedPages = await Page.find({ "config.linkedSourcePage": name });
      for (const p of linkedPages) {
        const linkedPageRows = await getSortedPageRows({ pageName: p.name });
        deletedRows.push(...linkedPageRows.map((r: any) => r.data));
        await Page.findOneAndDelete({ name: p.name });
        await PageRow.deleteMany({ pageName: p.name });
      }
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (page) {
        deletedRows = page.rows || [];
        db.pages = db.pages.filter((p: any) => p.name !== name);
      }
      
      const linkedPageNames: string[] = [];
      db.pages = db.pages.filter((p: any) => {
        if (p.config && p.config.linkedSourcePage === name) {
          linkedPageNames.push(p.name);
          if (p.rows) deletedRows.push(...p.rows);
          return false;
        }
        return true;
      });
      await saveLocalDB(db);
    }
    await cleanupOrphanImages(deletedRows, [], false, name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete page' });
  }
});

app.get('/api/url-image-size', async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.json({ ok: false });
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 8000);

    try {
      const headResponse = await fetch(url, {
        method: 'HEAD',
        signal: abortController.signal
      });
      
      if (headResponse.ok) {
        const contentLength = headResponse.headers.get('content-length');
        if (contentLength && !isNaN(Number(contentLength))) {
          clearTimeout(timeoutId);
          return res.json({ ok: true, sizeBytes: Number(contentLength) });
        }
      }
    } catch (e) {
      // Ignore HEAD failure
    }

    try {
      const getResponse = await fetch(url, {
        method: 'GET',
        signal: abortController.signal
      });

      if (!getResponse.ok || !getResponse.body) {
        clearTimeout(timeoutId);
        return res.json({ ok: false });
      }

      const reader = getResponse.body.getReader();
      let totalBytes = 0;
      const MAX_BYTES = 25 * 1024 * 1024;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > MAX_BYTES) {
            abortController.abort();
            break;
          }
        }
      }
      
      clearTimeout(timeoutId);
      return res.json({ ok: true, sizeBytes: totalBytes });
    } catch (e) {
      clearTimeout(timeoutId);
      return res.json({ ok: false });
    }

  } catch (err) {
    return res.json({ ok: false });
  }
});

app.post('/api/pages/update-config', async (req, res) => {
  try {
    const { pageName, name, config } = req.body;
    const finalPageName = name || pageName;
    if (isUsingMongoDB) {
      await Page.findOneAndUpdate({ name: finalPageName }, { config });
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === finalPageName);
      if (page) page.config = config;
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update config' });
  }
});

app.put('/api/pageConfigs/:name(*)', async (req, res) => {
  try {
    const { name } = req.params;
    const { config } = req.body;
    if (isUsingMongoDB) {
      await Page.findOneAndUpdate({ name }, { config });
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (page) page.config = config;
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update config' });
  }
});

app.put('/api/pageRows/:name(*)', async (req, res) => {
  try {
    const { name } = req.params;
    const { rows } = req.body;
    const forceSave = req.query.force === 'true';
    
    const incomingIds = (rows || []).map((r: any) => String(r.id)).filter((id: string) => id && id !== 'undefined' && id !== 'null');
    let existingOtherIds = new Set<string>();
    
    if (isUsingMongoDB) {
      if (incomingIds.length > 0) {
        const otherRows = await PageRow.find({ pageName: { $ne: name }, 'data.id': { $in: incomingIds } }, { 'data.id': 1, _id: 0 }).lean();
        otherRows.forEach((r: any) => {
          if (r.data?.id) existingOtherIds.add(String(r.data.id));
        });
      }
    } else {
      if (incomingIds.length > 0) {
        const db = await getLocalDB();
        db.pages.forEach((p: any) => {
          if (p.name !== name && p.rows) {
            p.rows.forEach((r: any) => {
              if (r.id && incomingIds.includes(String(r.id))) existingOtherIds.add(String(r.id));
            });
          }
        });
      }
    }

    let rowsToProcess = rows || [];
    const seenIds = new Set<string>(existingOtherIds);
    rowsToProcess = rowsToProcess.map((row: any) => {
      if (!row.id || seenIds.has(String(row.id))) {
        row.id = uuidv4();
      }
      seenIds.add(String(row.id));
      return row;
    });

    if (isUsingMongoDB) {
      const pageConfig = await Page.findOne({ name });
      const isTracker = pageConfig?.config?.linkedSourcePage;
      const newRows = isTracker ? rowsToProcess : await processRowsConcurrently(rowsToProcess, 50, forceSave);
      
      let session = null;
      try {
        session = await mongoose.startSession();
        session.startTransaction();

        await PageRow.deleteMany({ pageName: name }, { session });
        if (newRows.length > 0) {
          await PageRow.insertMany(newRows.map((row: any) => ({ pageName: name, data: row })), { session });
        }

        await session.commitTransaction();
      } catch (txnErr: any) {
        if (session) {
          await session.abortTransaction().catch(() => {});
        }
        const errMsg = (txnErr.message || '').toLowerCase();
        const isUnsupported = errMsg.includes('replica set') || errMsg.includes('transaction') || errMsg.includes('not supported') || txnErr.code === 20 || txnErr.code === 263 || txnErr.name === 'IllegalOperation';
        
        if (isUnsupported) {
          console.warn("Transaction not supported, falling back to sequential delete/insert:", txnErr.message);
          
          const backupRows = await PageRow.find({ pageName: name }).lean();
          
          try {
            await PageRow.deleteMany({ pageName: name });
            if (newRows.length > 0) {
              await PageRow.insertMany(newRows.map((row: any) => ({ pageName: name, data: row })));
            }
          } catch (fallbackErr) {
            console.error("Fallback delete/insert failed, attempting to restore backup...", fallbackErr);
            try {
              if (backupRows.length > 0) {
                await PageRow.insertMany(backupRows.map((r: any) => {
                  const doc = { ...r };
                  delete doc._id;
                  delete doc.__v;
                  return doc;
                }));
              }
            } catch (restoreErr) {
              console.error("Critical: Failed to restore backup!", restoreErr);
            }
            throw fallbackErr;
          }
        } else {
          throw txnErr;
        }
      } finally {
        if (session) {
          session.endSession();
        }
      }
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (page) {
        const isTracker = page.config?.linkedSourcePage;
        const newRows = isTracker ? rowsToProcess : await processRowsConcurrently(rowsToProcess, 50, forceSave);
        page.rows = newRows;
      }
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'SHARP_UNSUPPORTED_FORMAT') {
      return res.status(400).json({ requiresConfirmation: true, error: "Unsupported image format detected. The system can only process standard images (JPG, PNG, WEBP, GIF, AVIF, TIFF). Do you want to force save this file as-is without processing?" });
    }
    res.status(400).json({ error: err.message || 'Failed to update rows' });
  }
});

app.patch('/api/pageRows/:name(*)/bulk', async (req, res) => {
  try {
    const { name } = req.params;
    const { order, updates } = req.body;
    const forceSave = req.query.force === 'true';

    if (isUsingMongoDB) {
      if (updates && Object.keys(updates).length > 0) {
        const rowIds = Object.keys(updates).map(String);
        const rowsToUpdate = await PageRow.find({ pageName: name, 'data.id': { $in: rowIds } });
        
        const rowMap = new Map();
        for (const r of rowsToUpdate) {
          if (r.data && r.data.id != null) {
            rowMap.set(String(r.data.id), r);
          }
        }

        const bulkOps = [];
        for (const [rowId, upds] of Object.entries(updates)) {
          const rowToUpdate = rowMap.get(String(rowId));
          if (rowToUpdate) {
            const newRowData = { ...rowToUpdate.data, ...(upds as any) };
            const processedRow = await processRowImages(newRowData, forceSave);
            bulkOps.push({
              updateOne: {
                filter: { _id: rowToUpdate._id },
                update: { $set: { data: processedRow } }
              }
            });
          }
        }
        
        if (bulkOps.length > 0) {
          await PageRow.bulkWrite(bulkOps);
        }
      }
      if (order && Array.isArray(order) && order.length > 0) {
        let session = null;
        try {
          session = await mongoose.startSession();
          session.startTransaction();

          const bulkOps = order.map((id, index) => ({
            updateOne: {
              filter: { pageName: name, 'data.id': String(id) },
              update: { $set: { order: index } }
            }
          }));
          
          await PageRow.bulkWrite(bulkOps, { session });
          
          await session.commitTransaction();
        } catch (txnErr: any) {
          if (session) {
            await session.abortTransaction().catch(() => {});
          }
          console.warn("Transaction failed or not supported, falling back to sequential bulkWrite:", txnErr.message);
          
          const bulkOps = order.map((id, index) => ({
            updateOne: {
              filter: { pageName: name, 'data.id': String(id) },
              update: { $set: { order: index } }
            }
          }));
          await PageRow.bulkWrite(bulkOps);
        } finally {
          if (session) {
            session.endSession();
          }
        }
      }
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (!page) return res.status(404).json({ error: 'Page not found' });

      if (updates && Object.keys(updates).length > 0) {
        for (const [rowId, upds] of Object.entries(updates)) {
          const idx = page.rows?.findIndex((r: any) => String(r.id) === String(rowId));
          if (idx !== undefined && idx !== -1) {
            const newRowData = { ...page.rows[idx], ...(upds as any) };
            const processedRow = await processRowImages(newRowData, forceSave);
            page.rows[idx] = processedRow;
          }
        }
      }

      if (order && Array.isArray(order)) {
        const rowMap = new Map((page.rows || []).map((r: any) => [String(r.id), r]));
        const newOrderedRows = [];
        for (const id of order) {
          if (rowMap.has(id)) {
            newOrderedRows.push(rowMap.get(id));
            rowMap.delete(id);
          }
        }
        for (const r of rowMap.values()) {
           newOrderedRows.push(r);
        }
        page.rows = newOrderedRows;
      }
      await saveLocalDB(db);
    }

    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'SHARP_UNSUPPORTED_FORMAT') {
      return res.status(400).json({ requiresConfirmation: true, error: "Unsupported image format detected. Do you want to force save this file as-is without processing?" });
    }
    console.error("PATCH Bulk Error:", err);
    res.status(400).json({ error: err.message || 'Failed to bulk update' });
  }
});

app.patch('/api/pageRows/:name(*)/:rowId', async (req, res) => {
  try {
    const { name, rowId } = req.params;
    const { updates } = req.body;
    const forceSave = req.query.force === 'true';

    if (isUsingMongoDB) {
      const rowToUpdate = await PageRow.findOne({ pageName: name, 'data.id': String(rowId) });
      if (!rowToUpdate) {
        return res.status(404).json({ error: 'Row not found' });
      }

      const newRowData = { ...rowToUpdate.data, ...updates };
      const processedRow = await processRowImages(newRowData, forceSave);

      await PageRow.findByIdAndUpdate(rowToUpdate._id, { data: processedRow });
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (!page) return res.status(404).json({ error: 'Page not found' });

      const idx = page.rows?.findIndex((r: any) => String(r.id) === String(rowId));
      if (idx === undefined || idx === -1) {
        return res.status(404).json({ error: 'Row not found' });
      }

      const newRowData = { ...page.rows[idx], ...updates };
      const processedRow = await processRowImages(newRowData, forceSave);

      page.rows[idx] = processedRow;
      await saveLocalDB(db);
    }

    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'SHARP_UNSUPPORTED_FORMAT') {
      return res.status(400).json({ requiresConfirmation: true, error: "Unsupported image format detected. The system can only process standard images (JPG, PNG, WEBP, GIF, AVIF, TIFF). Do you want to force save this file as-is without processing?" });
    }
    console.error("PATCH Row Error:", err);
    res.status(400).json({ error: err.message || 'Failed to update row' });
  }
});

app.post('/api/pageRows/:name(*)/append', async (req, res) => {
  try {
    const { name } = req.params;
    const { rows } = req.body;
    const forceSave = req.query.force === 'true';

    let existingOtherIds = new Set<string>();
    const incomingIds = (rows || []).map((r: any) => String(r.id)).filter((id: string) => id && id !== 'undefined' && id !== 'null');
    
    if (isUsingMongoDB) {
      if (incomingIds.length > 0) {
        const matchingRows = await PageRow.find({ 'data.id': { $in: incomingIds } }, { 'data.id': 1, _id: 0 }).lean();
        matchingRows.forEach((r: any) => {
          if (r.data?.id) existingOtherIds.add(String(r.data.id));
        });
      }
    } else {
      const db = await getLocalDB();
      db.pages.forEach((p: any) => {
        if (p.rows) {
          p.rows.forEach((r: any) => {
            if (r.id && incomingIds.includes(String(r.id))) existingOtherIds.add(String(r.id));
          });
        }
      });
    }

    let rowsToProcess = rows || [];
    const seenIds = new Set<string>(existingOtherIds);
    rowsToProcess = rowsToProcess.map((row: any) => {
      if (!row.id || seenIds.has(String(row.id))) {
        row.id = uuidv4();
      }
      seenIds.add(String(row.id));
      return row;
    });

    const processedRows = await processRowsConcurrently(rowsToProcess, 50, forceSave);

    if (isUsingMongoDB) {
      const recordsToInsert = processedRows.map(data => ({
        pageName: name,
        data
      }));
      if (recordsToInsert.length > 0) {
        await PageRow.insertMany(recordsToInsert);
      }
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (!page) return res.status(404).json({ error: 'Page not found' });
      page.rows = [...(page.rows || []), ...processedRows];
      await saveLocalDB(db);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'SHARP_UNSUPPORTED_FORMAT') {
      return res.status(400).json({ requiresConfirmation: true, error: "Unsupported image format detected. The system can only process standard images (JPG, PNG, WEBP, GIF, AVIF, TIFF). Do you want to force save this file as-is without processing?" });
    }
    console.error("POST Append Error:", err);
    res.status(400).json({ error: err.message || 'Failed to append rows' });
  }
});

app.delete('/api/pageRows/:name(*)/:rowId', async (req, res) => {
  try {
    const { name, rowId } = req.params;
    let deletedRowData = null;

    if (isUsingMongoDB) {
      const allRows = await PageRow.find({ pageName: name });
      const rowToDelete = allRows.find(r => String(r.data.id) === String(rowId));
      if (!rowToDelete) {
        return res.status(404).json({ error: 'Row not found' });
      }
      deletedRowData = rowToDelete.data;
      await PageRow.findByIdAndDelete(rowToDelete._id);
      
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (!page) return res.status(404).json({ error: 'Page not found' });
      const rowToDelete = page.rows?.find((r: any) => String(r.id) === String(rowId));
      if (rowToDelete) {
        deletedRowData = rowToDelete;
        page.rows = page.rows.filter((r: any) => String(r.id) !== String(rowId));
        await saveLocalDB(db);
      }
    }
    
    if (deletedRowData) {
      await cleanupOrphanImages([deletedRowData], [], false);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE Row Error:", err);
    res.status(400).json({ error: err.message || 'Failed to delete row' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { globalCopyBoxes, globalRowNoWidth, maxSearchHistory, pageOrder } = req.body;
    if (isUsingMongoDB) {
      await AppSettings.findOneAndUpdate({}, { globalCopyBoxes, globalRowNoWidth, maxSearchHistory, pageOrder }, { upsert: true });
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      db.settings = { globalCopyBoxes, globalRowNoWidth, maxSearchHistory, pageOrder };
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update settings' });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    const payload = req.body;
    const isBundle = !!payload.isBundle;
    const isSinglePage = !!(payload.name && Array.isArray(payload.rows) && !payload.pages) && !isBundle;
    
    let newState = payload;

    // Smart Fallback: Detect if the user uploaded a single-page backup instead of a full state backup
    if (isBundle) {
      newState = {
        pages: payload.pages,
        pageConfigs: payload.pageConfigs,
        pageRows: payload.pageRows,
        globalCopyBoxes: null,
        globalRowNoWidth: 100,
        maxSearchHistory: 10
      };
    } else if (isSinglePage) {
      newState = {
        pages: [payload.name],
        pageConfigs: { [payload.name]: payload.config || {} },
        pageRows: { [payload.name]: payload.rows },
        // Keep default settings to prevent crashes
        globalCopyBoxes: null,
        globalRowNoWidth: 100,
        maxSearchHistory: 10
      };
    }
    
    // Fix duplicate IDs across all pages first
    if (newState.pageRows) {
      for (const pageName in newState.pageRows) {
        const seenIds = new Set<string>();
        newState.pageRows[pageName] = (newState.pageRows[pageName] || []).map((row: any) => {
          if (!row.id || seenIds.has(String(row.id))) {
            row.id = uuidv4();
          }
          seenIds.add(String(row.id));
          return row;
        });
      }
    }

    // Repair tracker rows from source pages before processing
    if (newState.pageConfigs && newState.pageRows) {
      for (const [trackerName, trackerConfig] of Object.entries(newState.pageConfigs)) {
        const config = trackerConfig as any;
        if (config.linkedSourcePage && newState.pageRows[config.linkedSourcePage]) {
          const sourceRows = newState.pageRows[config.linkedSourcePage];
          
          if (!newState.pageRows[trackerName]) {
            newState.pageRows[trackerName] = [];
          }
          
          const trackerRowsMap = new Map();
          for (const tr of newState.pageRows[trackerName]) {
            if (tr.id) trackerRowsMap.set(String(tr.id), tr);
          }
          
          const repairedTrackerRows = sourceRows.map((sr: any) => {
            const existingTr = trackerRowsMap.get(String(sr.id));
            if (existingTr) {
              const trackerKeysToKeep = [
                "total_qty",
                "remaining_qty"
              ];
              if (Array.isArray(config.columns)) {
                config.columns.forEach((c: any) => {
                  if (c.type === "sale_tracker" && c.key) {
                    trackerKeysToKeep.push(c.key);
                  }
                });
              }
              const preservedData: any = {};
              for (const k of trackerKeysToKeep) {
                if (k in existingTr) preservedData[k] = existingTr[k];
              }
              return { ...sr, ...preservedData };
            } else {
              return { ...sr, total_qty: "0" };
            }
          });
          
          newState.pageRows[trackerName] = repairedTrackerRows;
        }
      }
    }

    // Process all images in the new state
    const processedPageRows: Record<string, any[]> = {};
    const imageProcessingCache = new Map<string, Promise<string>>(); // Deduplication cache across all pages
    if (newState.pageRows) {
      for (const pageName in newState.pageRows) {
        const isTracker = newState.pageConfigs?.[pageName]?.linkedSourcePage;
        if (isTracker) {
          // Shallow copy for Linked Page/Live Tracker to avoid re-processing images
          processedPageRows[pageName] = [...newState.pageRows[pageName]];
        } else {
          processedPageRows[pageName] = await processRowsConcurrently(newState.pageRows[pageName], 50, true, imageProcessingCache);
        }
      }
    }

    if (isUsingMongoDB) {
      if (isSinglePage || isBundle) {
        const pagesToUpdate = isBundle ? newState.pages : [payload.name];
        for (const pageName of pagesToUpdate) {
          await Page.findOneAndUpdate(
            { name: pageName },
            { name: pageName, config: newState.pageConfigs[pageName] || {} },
            { upsert: true }
          );

          await PageRow.deleteMany({ pageName });

          const rows = processedPageRows[pageName] || [];
          const rowsToInsert = rows.map((row: any) => ({ pageName, data: row }));
          if (rowsToInsert.length > 0) {
            await PageRow.insertMany(rowsToInsert);
          }
        }
        await triggerLocalBackup();
      } else {
        // Fetch all existing rows to cleanup images
        const allOldPageRows = await getSortedPageRows({});
        const allOldRows = allOldPageRows.map((r: any) => r.data);
        
        const allNewRows: any[] = [];
        for (const pageName in processedPageRows) {
          allNewRows.push(...processedPageRows[pageName]);
        }
        
        await cleanupOrphanImages(allOldRows, allNewRows, true);
        await diskSweepOrphans(allNewRows);

        const snapPages = await Page.find({});
        const snapRows = await getSortedPageRows({});
        const snapSettings = await AppSettings.find({});

        try {
          // Clear existing data
          await Page.deleteMany({});
          await PageRow.deleteMany({});
          await AppSettings.deleteMany({});
          
          // Insert new pages (without rows)
          const pagesToInsert = newState.pages.map((name: string) => ({
            name,
            config: newState.pageConfigs[name] || {}
          }));
          
          if (pagesToInsert.length > 0) {
            await Page.insertMany(pagesToInsert);
          }

          // Insert all rows
          const allRowsToInsert: any[] = [];
          newState.pages.forEach((pageName: string) => {
            const rows = processedPageRows[pageName] || [];
            rows.forEach((row: any) => {
              allRowsToInsert.push({ pageName, data: row });
            });
          });

          if (allRowsToInsert.length > 0) {
            await PageRow.insertMany(allRowsToInsert);
          }
          
          // Update settings
          await AppSettings.findOneAndUpdate({}, {
            globalCopyBoxes: newState.globalCopyBoxes,
            globalRowNoWidth: newState.globalRowNoWidth,
            maxSearchHistory: newState.maxSearchHistory
          }, { upsert: true });

          await triggerLocalBackup();
        } catch (importErr: any) {
          console.error("Import failed, rolling back to snapshot:", importErr);
          await Page.deleteMany({});
          await PageRow.deleteMany({});
          await AppSettings.deleteMany({});

          if (snapPages.length > 0) {
            await Page.insertMany(snapPages.map(p => ({ name: p.name, config: p.config })));
          }
          if (snapRows.length > 0) {
            await PageRow.insertMany(snapRows.map(r => ({ pageName: r.pageName, data: r.data })));
          }
          if (snapSettings.length > 0) {
            await AppSettings.insertMany(snapSettings.map(s => ({
              globalCopyBoxes: s.globalCopyBoxes,
              globalRowNoWidth: s.globalRowNoWidth,
              maxSearchHistory: s.maxSearchHistory,
              pageOrder: s.pageOrder
            })));
          }
          throw new Error("Import failed, previous data restored");
        }
      }
    } else {
      const db = await getLocalDB();
      if (isSinglePage || isBundle) {
        const pagesToUpdate = isBundle ? newState.pages : [payload.name];
        for (const pageName of pagesToUpdate) {
          const pageIdx = db.pages.findIndex((p: any) => p.name === pageName);
          const newPageData = {
            name: pageName,
            config: newState.pageConfigs[pageName] || {},
            rows: processedPageRows[pageName] || []
          };

          if (pageIdx >= 0) {
            db.pages[pageIdx] = newPageData;
          } else {
            db.pages.push(newPageData);
          }
        }
        await saveLocalDB(db);
      } else {
        const allOldRows: any[] = [];
        db.pages.forEach((p: any) => {
          if (p.rows) allOldRows.push(...p.rows);
        });

        const allNewRows: any[] = [];
        for (const pageName in processedPageRows) {
          allNewRows.push(...processedPageRows[pageName]);
        }
        await cleanupOrphanImages(allOldRows, allNewRows, true);
        await diskSweepOrphans(allNewRows);

        const oldDbCopy = JSON.parse(JSON.stringify(db));

        try {
          const newDb = {
            pages: newState.pages.map((name: string) => ({
              name,
              config: newState.pageConfigs[name] || {},
              rows: processedPageRows[name] || []
            })),
            settings: {
              globalCopyBoxes: newState.globalCopyBoxes,
              globalRowNoWidth: newState.globalRowNoWidth,
              maxSearchHistory: newState.maxSearchHistory
            }
          };
          await saveLocalDB(newDb);
        } catch (importErr: any) {
          console.error("Import failed, rolling back to snapshot:", importErr);
          await saveLocalDB(oldDbCopy);
          throw new Error("Import failed, previous data restored");
        }
      }
    }
    
    // Clear processing cache to free up memory
    imageProcessingCache.clear();
    
    res.json({ success: true });
  } catch (err: any) {
    console.error('Bulk sync error:', err);
    res.status(400).json({ error: err.message || 'Failed to sync state' });
  }
});

app.post('/api/import-zip', upload.single('backup'), async (req, res) => {
  const isStream = req.query.stream === '1';
  if (isStream) {
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Transfer-Encoding': 'chunked', 'Cache-Control': 'no-cache' });
  }

  const sendProgress = (percent: number, message: string, file?: string) => {
    if (isStream) {
      res.write(JSON.stringify({ type: 'progress', percent, message, file }) + '\n');
    }
  };

  try {
    if (!req.file) {
      const errorMsg = 'No zip file uploaded';
      if (isStream) {
        res.end(JSON.stringify({ type: 'error', error: errorMsg }) + '\n');
        return;
      } else {
        return res.status(400).json({ error: errorMsg });
      }
    }

    const zip = new AdmZip(req.file.path);
    const zipEntries = zip.getEntries();
    
    sendProgress(5, 'Reading backup archive...');
    
    // Extract uploads if existing
    const uploadEntries = zipEntries.filter((entry: any) => entry.entryName.startsWith('uploads/') && !entry.isDirectory);
    const totalUploadEntries = uploadEntries.length;
    let extractedCount = 0;

    zipEntries.forEach((entry: any) => {
      if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
        extractedCount++;
        if (totalUploadEntries > 0) {
           const pct = 5 + Math.floor((extractedCount / totalUploadEntries) * 55);
           sendProgress(pct, 'Extracting images...', entry.entryName.replace(/^uploads\//, ''));
        }
        zip.extractEntryTo(entry.entryName, UPLOADS_DIR, false, true);
      }
    });

    const dataEntry = zipEntries.find((entry: any) => entry.entryName === 'data.json');
    if (!dataEntry) {
      const errorMsg = 'data.json not found in zip archive';
      if (isStream) {
        res.end(JSON.stringify({ type: 'error', error: errorMsg }) + '\n');
        return;
      } else {
        return res.status(400).json({ error: errorMsg });
      }
    }

    const payload = JSON.parse(dataEntry.getData().toString('utf8'));
    sendProgress(65, 'Reading data.json...');
    const isBundle = !!payload.isBundle;
    const isSinglePage = !!(payload.name && Array.isArray(payload.rows) && !payload.pages) && !isBundle;
    console.log(`Import ZIP detected: ${isBundle ? 'Bundle' : isSinglePage ? 'Single Page' : 'Full Backup'}`);
    
    let newState: any = {};

    // Smart Fallback: Normalize different backup formats into a single robust structure
    if (isBundle) {
      newState = {
        pages: payload.pages,
        pageConfigs: payload.pageConfigs,
        pageRows: payload.pageRows,
        globalCopyBoxes: null,
        globalRowNoWidth: 100,
        maxSearchHistory: 10
      };
    } else if (isSinglePage) {
      newState = {
        pages: [payload.name],
        pageConfigs: { [payload.name]: payload.config || {} },
        pageRows: { [payload.name]: Array.isArray(payload.rows) ? payload.rows : [] },
        globalCopyBoxes: null,
        globalRowNoWidth: 100,
        maxSearchHistory: 10
      };
    } else if (payload.pages && payload.pages.length > 0 && typeof payload.pages[0] === 'object') {
      // LocalDB legacy full backup format: { pages: [{ name, config, rows }] }
      const pageConfigs: any = {};
      const pageRows: any = {};
      const pageNames: string[] = [];
      payload.pages.forEach((p: any) => {
        if (p && p.name) {
          pageNames.push(p.name);
          pageConfigs[p.name] = p.config || {};
          pageRows[p.name] = p.rows || [];
        }
      });
      newState = {
        pages: pageNames,
        pageConfigs,
        pageRows,
        globalCopyBoxes: payload.settings?.globalCopyBoxes ?? null,
        globalRowNoWidth: payload.settings?.globalRowNoWidth ?? 100,
        maxSearchHistory: payload.settings?.maxSearchHistory ?? 10
      };
    } else {
      // Standard full backup format
      newState = payload;
      // Ensure fields exist so we don't crash from undefined reads
      newState.pageConfigs = newState.pageConfigs || {};
      newState.pageRows = newState.pageRows || {};
      newState.pages = Array.isArray(newState.pages) ? newState.pages : [];
    }

    // Fix duplicate IDs across all pages first
    if (newState.pageRows) {
      for (const pageName in newState.pageRows) {
        const seenIds = new Set<string>();
        newState.pageRows[pageName] = (newState.pageRows[pageName] || []).map((row: any) => {
          if (!row.id || seenIds.has(String(row.id))) {
            row.id = uuidv4();
          }
          seenIds.add(String(row.id));
          return row;
        });
      }
    }

    // Repair tracker rows from source pages before processing
    if (newState.pageConfigs && newState.pageRows) {
      for (const [trackerName, trackerConfig] of Object.entries(newState.pageConfigs)) {
        const config = trackerConfig as any;
        if (config.linkedSourcePage && newState.pageRows[config.linkedSourcePage]) {
          const sourceRows = newState.pageRows[config.linkedSourcePage];
          
          if (!newState.pageRows[trackerName]) {
            newState.pageRows[trackerName] = [];
          }
          
          const trackerRowsMap = new Map();
          for (const tr of newState.pageRows[trackerName]) {
            if (tr.id) trackerRowsMap.set(String(tr.id), tr);
          }
          
          const repairedTrackerRows = sourceRows.map((sr: any) => {
            const existingTr = trackerRowsMap.get(String(sr.id));
            if (existingTr) {
              const trackerKeysToKeep = [
                "total_qty",
                "remaining_qty"
              ];
              if (Array.isArray(config.columns)) {
                config.columns.forEach((c: any) => {
                  if (c.type === "sale_tracker" && c.key) {
                    trackerKeysToKeep.push(c.key);
                  }
                });
              }
              const preservedData: any = {};
              for (const k of trackerKeysToKeep) {
                if (k in existingTr) preservedData[k] = existingTr[k];
              }
              return { ...sr, ...preservedData };
            } else {
              return { ...sr, total_qty: "0" };
            }
          });
          
          newState.pageRows[trackerName] = repairedTrackerRows;
        }
      }
    }

    sendProgress(70, 'Preparing pages and rows...');

    // We do NOT process base64 images here because they are already extracted physical files.
    const processedPageRows = newState.pageRows || {};

    if (isUsingMongoDB) {
      if (isSinglePage || isBundle) {
        const pagesToUpdate = isBundle ? newState.pages : [payload.name];
        for (let i = 0; i < pagesToUpdate.length; i++) {
          const pageName = pagesToUpdate[i];
          const pct = 70 + Math.floor((i / pagesToUpdate.length) * 25);
          const rows = processedPageRows[pageName] || [];
          sendProgress(pct, `Importing page "${pageName}" (${rows.length} rows)...`);
          
          // Upsert page config
          await Page.findOneAndUpdate(
            { name: pageName },
            { name: pageName, config: newState.pageConfigs[pageName] || {} },
            { upsert: true }
          );

          // Delete only the rows belonging to that specific page
          await PageRow.deleteMany({ pageName });

          // Insert only the new rows for that page
          const rowsToInsert = rows.map((row: any) => ({ pageName, data: row }));
          if (rowsToInsert.length > 0) {
            await PageRow.insertMany(rowsToInsert);
          }
        }
      } else {
        // Fetch all existing rows to cleanup images
        const allOldPageRows = await getSortedPageRows({});
        const allOldRows = allOldPageRows.map((r: any) => r.data);
        
        const allNewRows: any[] = [];
        for (const pageName in processedPageRows) {
          allNewRows.push(...processedPageRows[pageName]);
        }
        
        sendProgress(96, 'Cleaning up unused images...');
        await cleanupOrphanImages(allOldRows, allNewRows, true);
        await diskSweepOrphans(allNewRows);

        // Clear existing data
        await Page.deleteMany({});
        await PageRow.deleteMany({});
        await AppSettings.deleteMany({});
        
        // Insert new pages (without rows)
        const pagesToInsert = newState.pages.map((name: string) => ({
          name,
          config: newState.pageConfigs[name] || {}
        }));
        
        if (pagesToInsert.length > 0) {
          await Page.insertMany(pagesToInsert);
        }

        // Insert all rows
        const allRowsToInsert: any[] = [];
        const totalPages = newState.pages.length;
        newState.pages.forEach((pageName: string, i: number) => {
          const pct = 70 + Math.floor((i / Math.max(1, totalPages)) * 23);
          const rows = processedPageRows[pageName] || [];
          sendProgress(pct, `Importing page "${pageName}" (${rows.length} rows)...`);
          rows.forEach((row: any) => {
            allRowsToInsert.push({ pageName, data: row });
          });
        });

        if (allRowsToInsert.length > 0) {
          sendProgress(93, 'Writing to database...');
          await PageRow.insertMany(allRowsToInsert);
        }
        
        // Update settings
        await AppSettings.findOneAndUpdate({}, {
          globalCopyBoxes: newState.globalCopyBoxes,
          globalRowNoWidth: newState.globalRowNoWidth,
          maxSearchHistory: newState.maxSearchHistory
        }, { upsert: true });
      }
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      if (isSinglePage || isBundle) {
        const pagesToUpdate = isBundle ? newState.pages : [payload.name];
        for (let i = 0; i < pagesToUpdate.length; i++) {
          const pageName = pagesToUpdate[i];
          const pct = 70 + Math.floor((i / pagesToUpdate.length) * 25);
          const newRows = processedPageRows[pageName] || [];
          sendProgress(pct, `Importing page "${pageName}" (${newRows.length} rows)...`);
          
          const pageIdx = db.pages.findIndex((p: any) => p.name === pageName);
          const newPageData = {
            name: pageName,
            config: newState.pageConfigs[pageName] || {},
            rows: newRows
          };
          if (pageIdx >= 0) {
            db.pages[pageIdx] = newPageData;
          } else {
            db.pages.push(newPageData);
          }
        }
        await saveLocalDB(db);
      } else {
        const allOldRows: any[] = [];
        db.pages.forEach((p: any) => {
          if (p.rows) allOldRows.push(...p.rows);
        });
        const allNewRows: any[] = [];
        for (const pageName in processedPageRows) {
          allNewRows.push(...processedPageRows[pageName]);
        }
        
        sendProgress(96, 'Cleaning up unused images...');
        await cleanupOrphanImages(allOldRows, allNewRows, true);
        await diskSweepOrphans(allNewRows);

        const totalPages = newState.pages.length;
        const newDb = {
          pages: newState.pages.map((name: string, i: number) => {
            const pct = 70 + Math.floor((i / Math.max(1, totalPages)) * 25);
            const rows = processedPageRows[name] || [];
            sendProgress(pct, `Importing page "${name}" (${rows.length} rows)...`);
            
            return {
              name,
              config: newState.pageConfigs[name] || {},
              rows: rows
            };
          }),
          settings: {
            globalCopyBoxes: newState.globalCopyBoxes,
            globalRowNoWidth: newState.globalRowNoWidth,
            maxSearchHistory: newState.maxSearchHistory
          }
        };
        await saveLocalDB(newDb);
      }
    }

    // Clean up temp file
    fs.unlinkSync(req.file.path);
    
    if (isStream) {
      res.end(JSON.stringify({ type: 'done', percent: 100, message: 'Import complete', success: true }) + '\n');
    } else {
      res.json({ success: true });
    }
  } catch (err: any) {
    console.error('Import zip error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    const errorMsg = err.message || 'Failed to import zip state';
    if (isStream) {
      res.end(JSON.stringify({ type: 'error', error: errorMsg }) + '\n');
    } else {
      res.status(400).json({ error: errorMsg });
    }
  }
});

// Vite Middleware for Development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function flushBackupAndExit() {
  if (localBackupTimeout) {
    clearTimeout(localBackupTimeout);
    localBackupTimeout = null;
    await performLocalBackup();
  } else if (pendingBackup) {
    await performLocalBackup();
  }
  process.exit(0);
}

process.on('SIGINT', flushBackupAndExit);
process.on('SIGTERM', flushBackupAndExit);

startServer();
