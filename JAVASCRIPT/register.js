const Register = {
    // Step 1 is never sent to the backend on its own — there's no user
    // row to attach it to until step 2 supplies a unique email. We hold
    // it here and bundle it into the /register call.
    draft: {},
    currentStep: 1,
    resendCooldownInterval: null,

    async init() {
        const params = new URLSearchParams(window.location.search);
        const requestedStage = parseInt(params.get('stage'), 10);

        // Resuming: if we already have a token, ask the backend where
        // this user actually is — never trust the URL alone.
        if (Utils.isAuthenticated()) {
            try {
                const me = await API.getCurrentUser();
                if (me.registration_status === 'active') {
                    window.location.href = '/dashboard.html';
                    return;
                }
                if (me.registration_status === 'email_pending') {
                    this.prefillReview();
                    this.goToStep(5, true);
                    return;
                }
                const stage = me.signup_stage || 2;
                this.goToStep(Math.max(2, stage), true);
                return;
            } catch (e) {
                // Token invalid/expired — fall through to a fresh signup.
                API.clearTokens();
            }
        }

        if (requestedStage >= 1 && requestedStage <= 5) {
            this.goToStep(requestedStage === 1 ? 1 : requestedStage, true);
        } else {
            this.goToStep(1, true);
        }

        this.setupOtpInputs();
        this.setupPasswordStrength();
    },

    setupPasswordStrength() {
        const input = document.getElementById('s2_password');
        if (!input) return;
        input.addEventListener('input', () => {
            const val = input.value;
            const rules = {
                length: val.length >= 8,
                upper: /[A-Z]/.test(val),
                lower: /[a-z]/.test(val),
                number: /[0-9]/.test(val),
                special: /[^A-Za-z0-9]/.test(val)
            };
            Object.entries(rules).forEach(([rule, met]) => {
                const el = document.querySelector(`#s2_requirements li[data-rule="${rule}"]`);
                if (el) el.classList.toggle('met', met);
            });
        });
    },

    setupOtpInputs() {
        const digits = document.querySelectorAll('.otp-digit');
        digits.forEach((input, i) => {
            input.addEventListener('input', () => {
                input.value = input.value.replace(/[^0-9]/g, '');
                if (input.value && digits[i + 1]) digits[i + 1].focus();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && digits[i - 1]) digits[i - 1].focus();
            });
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6);
                pasted.split('').forEach((char, idx) => { if (digits[idx]) digits[idx].value = char; });
                if (digits[pasted.length]) digits[pasted.length].focus();
            });
        });
    },

    togglePassword(id) {
        const input = document.getElementById(id);
        input.type = input.type === 'password' ? 'text' : 'password';
    },

    showError(msg) {
        const el = document.getElementById('registerError');
        el.textContent = msg;
        el.style.display = 'block';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    clearError() {
        document.getElementById('registerError').style.display = 'none';
    },

    goToStep(step, skipValidation = false) {
        this.clearError();
        document.querySelectorAll('.signup-step').forEach(s => s.style.display = 'none');
        const target = document.getElementById(`step${step}`);
        if (target) target.style.display = 'block';

        document.querySelectorAll('.signup-progress-step').forEach(el => {
            const s = parseInt(el.dataset.step, 10);
            el.classList.toggle('active', s === step);
            el.classList.toggle('done', s < step);
        });
        const mobileLabel = document.getElementById('signupProgressMobile');
        if (mobileLabel) mobileLabel.textContent = `Step ${step} of 5`;

        this.currentStep = step;
    },

    validateStep1() {
        const first_name = document.getElementById('s1_first_name').value.trim();
        const last_name = document.getElementById('s1_last_name').value.trim();
        const date_of_birth = document.getElementById('s1_dob').value;
        const gender = document.getElementById('s1_gender').value;

        if (!first_name || !last_name) { this.showError('Please enter your first and last name.'); return null; }
        if (!date_of_birth) { this.showError('Please enter your date of birth.'); return null; }
        if (!gender) { this.showError('Please select a gender option.'); return null; }

        return {
            first_name,
            middle_name: document.getElementById('s1_middle_name').value.trim(),
            last_name,
            date_of_birth,
            gender
        };
    },

    // "Continue" from step 1 just validates and advances — nothing saved yet.
    // (goToStep is called directly from the button; this hook lets us
    // validate first.)
    async submitStep2() {
        const step1 = this.validateStep1();
        // Re-validate step 1 fields even though we're leaving step 2,
        // since step 1 never hit the backend on its own.
        if (!document.getElementById('s1_first_name').value.trim()) {
            this.goToStep(1);
            return;
        }

        const password = document.getElementById('s2_password').value;
        const confirm_password = document.getElementById('s2_confirm').value;
        const email = document.getElementById('s2_email').value.trim();

        if (!email) return this.showError('Please enter your email address.');
        if (password !== confirm_password) return this.showError('Passwords do not match.');

        const btn = document.getElementById('step2ContinueBtn');
        btn.disabled = true;
        btn.textContent = 'Creating account...';

        try {
            const payload = {
                ...this.validateStep1(),
                email,
                password,
                confirm_password
            };

            const response = await API.register(payload);
            API.setToken(response.token);
            this.draft.email = email;
            this.goToStep(3);
        } catch (error) {
            if (error.message && error.message.includes('sign in')) {
                this.showError(error.message + ' Redirecting to sign in...');
                setTimeout(() => window.location.href = '/login.html', 2000);
            } else {
                this.showError(error.message);
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Continue';
        }
    },

    async submitStep3() {
        const country = document.getElementById('s3_country').value;
        const state = document.getElementById('s3_state').value.trim();
        const city = document.getElementById('s3_city').value.trim();
        const address = document.getElementById('s3_address').value.trim();

        if (!country || !state || !city || !address) {
            return this.showError('Please complete all location fields.');
        }

        const btn = document.getElementById('step3ContinueBtn');
        btn.disabled = true;

        try {
            await API.updateRegistrationLocation({ country, state, city, address });
            await this.prefillReview();
            this.goToStep(4);
        } catch (error) {
            this.showError(error.message);
        } finally {
            btn.disabled = false;
        }
    },

    async prefillReview() {
        try {
            const review = await API.getRegistrationReview();
            const p = review.personal;
            document.getElementById('review_name').textContent =
                `${p.first_name} ${p.middle_name ? p.middle_name + ' ' : ''}${p.last_name}`;
            document.getElementById('review_dob').textContent = `Date of birth: ${p.date_of_birth}`;
            document.getElementById('review_gender').textContent = `Gender: ${p.gender.replace(/_/g, ' ')}`;
            document.getElementById('review_email').textContent = review.email;
            document.getElementById('review_location').textContent =
                `${review.location.city}, ${review.location.state}, ${review.location.country}`;
            document.getElementById('review_address').textContent = review.location.address;
            document.getElementById('verify_email_display').textContent = review.email;
            this.draft.email = review.email;
        } catch (error) {
            console.error('Failed to load review', error);
        }
    },

    async submitStep4() {
        const btn = document.getElementById('step4ContinueBtn');
        btn.disabled = true;
        btn.textContent = 'Sending code...';

        try {
            await API.sendVerificationCode();
            this.goToStep(5);
            this.startResendCooldown();
        } catch (error) {
            this.showError(error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Continue';
        }
    },

    async submitVerification() {
        const digits = Array.from(document.querySelectorAll('.otp-digit')).map(i => i.value).join('');
        if (digits.length !== 6) return this.showError('Please enter the 6-digit code.');

        const btn = document.getElementById('verifyBtn');
        btn.disabled = true;
        btn.textContent = 'Verifying...';

        try {
            const response = await API.verifyEmailCode(digits);
            API.setToken(response.token);
            this.goToStep('Done');
        } catch (error) {
            this.showError(error.message);
            document.querySelectorAll('.otp-digit').forEach(i => i.value = '');
            document.querySelector('.otp-digit')?.focus();
        } finally {
            btn.disabled = false;
            btn.textContent = 'Verify';
        }
    },

    async resendCode() {
        try {
            await API.resendVerificationCode();
            Utils.showToast('A new code has been sent.', 'success');
            this.startResendCooldown();
        } catch (error) {
            this.showError(error.message);
        }
    },

    startResendCooldown(seconds = 60) {
        const link = document.getElementById('resendLink');
        const cooldownEl = document.getElementById('resendCooldown');
        let remaining = seconds;

        link.style.display = 'none';
        cooldownEl.style.display = 'inline';

        clearInterval(this.resendCooldownInterval);
        this.resendCooldownInterval = setInterval(() => {
            remaining--;
            cooldownEl.textContent = `Resend available in ${remaining}s`;
            if (remaining <= 0) {
                clearInterval(this.resendCooldownInterval);
                link.style.display = 'inline';
                cooldownEl.style.display = 'none';
            }
        }, 1000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('register.html')) {
        Register.init();
    }
});