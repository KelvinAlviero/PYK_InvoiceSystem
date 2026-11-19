export function collectRegistrationData(form) {
    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
        if (value instanceof File) {
            if (value.name) {
                data[key] = {
                    name: value.name,
                    type: value.type,
                    size: value.size
                };
            }
        } else {
            data[key] = value;
        }
    });

    return data;
}
