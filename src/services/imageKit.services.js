const ImageKit = require("imagekit");
const AppError = require("../utils/AppError");

let _ik = null;

const getClient = () => {
  if (_ik) return _ik;

  const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;

  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
    throw new AppError(
      "ImageKit is not configured. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT.",
      500
    );
  }

  _ik = new ImageKit({
    publicKey:   IMAGEKIT_PUBLIC_KEY,
    privateKey:  IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
  });

  return _ik;
};

const uploadImage = async (buffer, originalName, folder = "/products") => {
  const ik     = getClient();
  const result = await ik.upload({
    file:              buffer.toString("base64"),
    fileName:          originalName,
    folder,
    useUniqueFileName: true,
    tags:              ["product"],
  });

  return {
    url:      result.url,
    fileId:   result.fileId,
    fileName: result.name,
    width:    result.width,
    height:   result.height,
    size:     result.size,
    mimeType: result.fileType,
  };
};

const deleteImage = async (fileId) => {
  if (!fileId) return;
  try {
    await getClient().deleteFile(fileId);
  } catch (err) {
    // Soft-warn — a missing CDN file must not roll back a DB update
    console.warn(`[ImageKit] Could not delete fileId "${fileId}":`, err.message);
  }
};

const deleteImages = async (fileIds = []) => {
  await Promise.allSettled(fileIds.map(deleteImage));
};

module.exports = { uploadImage, deleteImage, deleteImages };