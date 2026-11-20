const MAX_FILE_SIZE = 5 * 1024 * 1024;

function readFileAsBase64(file) {
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`${file.name} is larger than 5 MB.`);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.addEventListener('load', () => {
            const result = String(reader.result ?? '');
            const base64Data = result.split(',')[1];

            if (!base64Data) {
                reject(new Error(`Unable to read ${file.name}.`));
                return;
            }

            resolve({
                name: file.name,
                type: file.type || 'application/pdf',
                size: file.size,
                base64Data
            });
        });

        reader.addEventListener('error', () => {
            reject(new Error(`Unable to read ${file.name}.`));
        });

        reader.readAsDataURL(file);
    });
}

export async function collectRegistrationData(form) {
    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
            if (value.name) {
                data[key] = await readFileAsBase64(value);
            }
        } else {
            data[key] = value;
        }
    }

    return data;
}
