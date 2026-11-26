const MAX_FILE_SIZE = 5 * 1024 * 1024;

function checkFile(file) {
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`${file.name} is larger than 5 MB.`);
    }
    if (file.type && file.type !== 'application/pdf') {
        throw new Error(`${file.name} is not a PDF file.`);
    }
    return file;
}

// Reads one registration step. Files stay as File objects (uploaded as multipart at
// the end, no base64). An empty file input is skipped, so a file chosen on an earlier
// visit to this step is kept.
export async function collectRegistrationData(form) {
    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
            if (value.name) {
                data[key] = checkFile(value);
            }
        } else {
            data[key] = value;
        }
    }

    return data;
}
