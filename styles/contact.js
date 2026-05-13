document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.querySelector('form');
    
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            message: document.getElementById('message').value
        };

        try {
            const response = await fetch('https://atlantis-web.onrender.com/api/contact', {
                method: 'POST', // Crucial fix for the error you saw on localhost
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert('Message sent to Atlantis!');
                contactForm.reset();
            } else {
                alert('Server error. Try again!');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to connect to the server.');
        }
    });
});
