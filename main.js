
// THEME TOGGLE

const body = document.body;
const btn = document.getElementById("themeBtn");

let savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {
    body.classList.add("dark");
} else {
    body.classList.add("light");
}

if (btn) {
    btn.addEventListener("click", () => {
        if (body.classList.contains("light")) {
            body.classList.replace("light", "dark");
            localStorage.setItem("theme", "dark");
        } else {
            body.classList.replace("dark", "light");
            localStorage.setItem("theme", "light");
        }
    });
}


// CONTACT FORM

const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

function showFormMessage(message, type = 'error') {
    if (formMessage) {
        formMessage.textContent = message;
        formMessage.className = 'form-message ' + type;
    }
}

if (contactForm) {
    contactForm.addEventListener("submit", function(e) {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const message = document.getElementById("message").value.trim();

        showFormMessage('', '');

        if (name === "") {
            return showFormMessage("Name is required!");
        }

        if (email === "") {
            return showFormMessage("Email is required!");
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            return showFormMessage("Enter valid email!");
        }

        if (message === "") {
            return showFormMessage("Message cannot be empty!");
        }

        const submitBtn = contactForm.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = 'Sending...';
        submitBtn.disabled = true;

        const formData = { name, email, message };
        localStorage.setItem("contactFormData", JSON.stringify(formData));

        setTimeout(() => {
            showFormMessage("Message sent successfully!", 'success');
            contactForm.reset();

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }, 1000);
    });
}


// FORM INPUT BORDER EFFECT

document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('#contactForm input, #contactForm textarea');

    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            this.style.borderColor = this.value.trim() === '' ? 'red' : 'blue';
        });
    });
});


// NAVBAR SCROLL EFFECT

window.addEventListener('scroll', function() {
    const nav = document.querySelector('.main');

    if (nav) {
        if (window.scrollY > 100) {
            nav.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        } else {
            nav.style.boxShadow = 'none';
        }
    }
});