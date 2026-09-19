

-- Complete Banking Database Schema
-- For Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CURRENCIES
-- ============================================================
CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(3) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(5) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO currencies (code, name, symbol) VALUES
('USD', 'US Dollar', '$'),
('EUR', 'Euro', '€'),
('GBP', 'British Pound', '£'),
('CAD', 'Canadian Dollar', 'C$'),
('AUD', 'Australian Dollar', 'A$'),
('CHF', 'Swiss Franc', 'CHF'),
('JPY', 'Japanese Yen', '¥'),
('CNY', 'Chinese Yuan', '¥'),
('AED', 'UAE Dirham', 'د.إ'),
('NGN', 'Nigerian Naira', '₦');

-- ============================================================
-- EXCHANGE RATES
-- ============================================================
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    to_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    rate DECIMAL(20,8) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_currency, to_currency)
);

-- Seed some exchange rates (relative to USD)
INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
('USD', 'EUR', 0.92000000),
('USD', 'GBP', 0.79000000),
('USD', 'CAD', 1.36000000),
('USD', 'AUD', 1.53000000),
('USD', 'CHF', 0.88000000),
('USD', 'JPY', 149.50000000),
('USD', 'CNY', 7.24000000),
('USD', 'AED', 3.67000000),
('USD', 'NGN', 1550.00000000),
('EUR', 'USD', 1.08700000),
('GBP', 'USD', 1.26500000);

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    pin_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_suspended BOOLEAN DEFAULT false,
    is_frozen BOOLEAN DEFAULT false,
    freeze_transfers BOOLEAN DEFAULT false,
    freeze_withdrawals BOOLEAN DEFAULT false,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200),
    date_of_birth DATE,
    country VARCHAR(100),
    nationality VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    occupation VARCHAR(100),
    tax_residency VARCHAR(100),
    tax_id VARCHAR(100),
    profile_photo_url TEXT,
    kyc_status VARCHAR(20) DEFAULT 'pending',
    kyc_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACCOUNTS (Multi-currency)
-- ============================================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(30) DEFAULT 'checking',
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE account_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    available_balance DECIMAL(20,4) DEFAULT 0,
    pending_balance DECIMAL(20,4) DEFAULT 0,
    total_deposits DECIMAL(20,4) DEFAULT 0,
    total_withdrawals DECIMAL(20,4) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS (Double-entry ledger)
-- ============================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference VARCHAR(50) UNIQUE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    debit_account_id UUID REFERENCES accounts(id),
    credit_account_id UUID REFERENCES accounts(id),
    amount DECIMAL(20,4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    fee DECIMAL(20,4) DEFAULT 0,
    exchange_rate DECIMAL(20,8),
    original_amount DECIMAL(20,4),
    original_currency VARCHAR(3),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    initiated_by UUID REFERENCES users(id),
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT
);

CREATE INDEX idx_transactions_debit ON transactions(debit_account_id);
CREATE INDEX idx_transactions_credit ON transactions(credit_account_id);
CREATE INDEX idx_transactions_user ON transactions(initiated_by);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at);

-- ============================================================
-- BENEFICIARIES
-- ============================================================
CREATE TABLE beneficiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(200),
    bank_code VARCHAR(20),
    country VARCHAR(100),
    currency VARCHAR(3) REFERENCES currencies(code),
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSFER LIMITS
-- ============================================================
CREATE TABLE transfer_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    single_transfer_min DECIMAL(20,4) DEFAULT 1,
    single_transfer_max DECIMAL(20,4) DEFAULT 50000,
    daily_transfer_limit DECIMAL(20,4) DEFAULT 100000,
    weekly_transfer_limit DECIMAL(20,4) DEFAULT 500000,
    monthly_transfer_limit DECIMAL(20,4) DEFAULT 2000000,
    daily_transfer_count INTEGER DEFAULT 50,
    weekly_transfer_count INTEGER DEFAULT 200,
    monthly_transfer_count INTEGER DEFAULT 500,
    single_withdrawal_min DECIMAL(20,4) DEFAULT 10,
    single_withdrawal_max DECIMAL(20,4) DEFAULT 10000,
    daily_withdrawal_limit DECIMAL(20,4) DEFAULT 20000,
    weekly_withdrawal_limit DECIMAL(20,4) DEFAULT 50000,
    monthly_withdrawal_limit DECIMAL(20,4) DEFAULT 200000,
    daily_withdrawal_count INTEGER DEFAULT 10,
    weekly_withdrawal_count INTEGER DEFAULT 30,
    monthly_withdrawal_count INTEGER DEFAULT 100,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LIMIT TRACKING (current period usage)
-- ============================================================
CREATE TABLE limit_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly
    period_start DATE NOT NULL,
    transfer_amount DECIMAL(20,4) DEFAULT 0,
    transfer_count INTEGER DEFAULT 0,
    withdrawal_amount DECIMAL(20,4) DEFAULT 0,
    withdrawal_count INTEGER DEFAULT 0,
    UNIQUE(user_id, period_type, period_start)
);

-- ============================================================
-- LIMIT REQUESTS
-- ============================================================
CREATE TABLE limit_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    limit_type VARCHAR(50) NOT NULL,
    current_value DECIMAL(20,4),
    requested_value DECIMAL(20,4),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OTP SYSTEM
-- ============================================================
CREATE TABLE otp_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_transfers_enabled BOOLEAN DEFAULT true,
    otp_withdrawals_enabled BOOLEAN DEFAULT true,
    otp_card_actions_enabled BOOLEAN DEFAULT false,
    otp_beneficiary_creation BOOLEAN DEFAULT false,
    otp_currency_conversion BOOLEAN DEFAULT false,
    otp_amount_threshold DECIMAL(20,4) DEFAULT 500,
    otp_international_transfers BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE otp_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_type VARCHAR(50) NOT NULL,
    challenge_context JSONB DEFAULT '{}',
    otp_code VARCHAR(6),
    otp_hash VARCHAR(255),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    is_verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CARDS
-- ============================================================
CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    card_number_hash VARCHAR(255) NOT NULL,
    card_last_four VARCHAR(4) NOT NULL,
    card_type VARCHAR(20) DEFAULT 'debit',
    card_brand VARCHAR(20) DEFAULT 'visa',
    is_virtual BOOLEAN DEFAULT false,
    expiry_month INTEGER NOT NULL,
    expiry_year INTEGER NOT NULL,
    cvv_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'inactive',
    is_frozen BOOLEAN DEFAULT false,
    international_enabled BOOLEAN DEFAULT true,
    online_enabled BOOLEAN DEFAULT true,
    atm_enabled BOOLEAN DEFAULT true,
    contactless_enabled BOOLEAN DEFAULT true,
    daily_limit DECIMAL(20,4) DEFAULT 5000,
    monthly_limit DECIMAL(20,4) DEFAULT 50000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ
);

CREATE TABLE card_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    merchant VARCHAR(200),
    amount DECIMAL(20,4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    transaction_type VARCHAR(30) DEFAULT 'purchase',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAVINGS
-- ============================================================
CREATE TABLE savings_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    savings_type VARCHAR(30) DEFAULT 'flexible',
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    balance DECIMAL(20,4) DEFAULT 0,
    target_amount DECIMAL(20,4),
    interest_rate DECIMAL(5,2) DEFAULT 0,
    interest_earned DECIMAL(20,4) DEFAULT 0,
    maturity_date DATE,
    auto_save_enabled BOOLEAN DEFAULT false,
    auto_save_amount DECIMAL(20,4),
    auto_save_frequency VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE savings_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    savings_account_id UUID NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL,
    amount DECIMAL(20,4) NOT NULL,
    balance_after DECIMAL(20,4) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVESTMENTS
-- ============================================================
CREATE TABLE investment_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    asset_type VARCHAR(30) NOT NULL,
    current_price DECIMAL(20,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    daily_change DECIMAL(10,4) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO investment_assets (symbol, name, asset_type, current_price) VALUES
('AAPL', 'Apple Inc.', 'stock', 189.50),
('MSFT', 'Microsoft Corp.', 'stock', 378.20),
('GOOGL', 'Alphabet Inc.', 'stock', 141.80),
('AMZN', 'Amazon.com Inc.', 'stock', 178.30),
('TSLA', 'Tesla Inc.', 'stock', 248.90),
('VTI', 'Vanguard Total Stock Market ETF', 'etf', 245.60),
('VOO', 'Vanguard S&P 500 ETF', 'etf', 435.20),
('BND', 'Vanguard Total Bond Market ETF', 'etf', 72.10),
('US-TREASURY-10Y', 'US Treasury 10Y Bond', 'bond', 100.00),
('CORP-BOND-AAA', 'AAA Corporate Bond Fund', 'bond', 102.50),
('FD-6M', '6-Month Fixed Deposit 4.5%', 'fixed_deposit', 100.00),
('FD-12M', '12-Month Fixed Deposit 5.0%', 'fixed_deposit', 100.00);

CREATE TABLE investment_portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_invested DECIMAL(20,4) DEFAULT 0,
    current_value DECIMAL(20,4) DEFAULT 0,
    total_gain_loss DECIMAL(20,4) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE investment_holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES investment_portfolios(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES investment_assets(id),
    quantity DECIMAL(20,6) NOT NULL,
    avg_cost DECIMAL(20,4) NOT NULL,
    current_value DECIMAL(20,4) DEFAULT 0,
    unrealized_gain_loss DECIMAL(20,4) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE investment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES investment_portfolios(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES investment_assets(id),
    transaction_type VARCHAR(10) NOT NULL,
    quantity DECIMAL(20,6) NOT NULL,
    price DECIMAL(20,4) NOT NULL,
    total_amount DECIMAL(20,4) NOT NULL,
    fee DECIMAL(20,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOANS
-- ============================================================
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    loan_type VARCHAR(30) NOT NULL,
    principal_amount DECIMAL(20,4) NOT NULL,
    outstanding_balance DECIMAL(20,4) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    term_months INTEGER NOT NULL,
    monthly_payment DECIMAL(20,4) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    total_paid DECIMAL(20,4) DEFAULT 0,
    total_interest_paid DECIMAL(20,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loan_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    payment_number INTEGER NOT NULL,
    principal_paid DECIMAL(20,4) NOT NULL,
    interest_paid DECIMAL(20,4) NOT NULL,
    total_paid DECIMAL(20,4) NOT NULL,
    balance_after DECIMAL(20,4) NOT NULL,
    payment_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'paid',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUPPORT SYSTEM
-- ============================================================
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    subject VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(30) DEFAULT 'open',
    assigned_to UUID REFERENCES users(id),
    limit_request_id UUID REFERENCES limit_requests(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    sender_type VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    channel VARCHAR(20) DEFAULT 'in_app',
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at);

-- ============================================================
-- ADMIN SYSTEM
-- ============================================================
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role_id UUID NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    UNIQUE(role_id, permission)
);

-- ============================================================
-- IMPERSONATION
-- ============================================================
CREATE TABLE impersonation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admin_users(id),
    target_user_id UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT,
    reason TEXT,
    is_active BOOLEAN DEFAULT true
);

-- ============================================================
-- BALANCE ADJUSTMENTS
-- ============================================================
CREATE TABLE balance_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_number VARCHAR(20) UNIQUE NOT NULL,
    admin_id UUID NOT NULL REFERENCES admin_users(id),
    target_user_id UUID NOT NULL REFERENCES users(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    adjustment_type VARCHAR(20) NOT NULL,
    amount DECIMAL(20,4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    balance_before DECIMAL(20,4) NOT NULL,
    balance_after DECIMAL(20,4) NOT NULL,
    reason TEXT NOT NULL,
    reference VARCHAR(50),
    is_reversed BOOLEAN DEFAULT false,
    reversed_by UUID REFERENCES admin_users(id),
    reversed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT,
    reference VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at);
CREATE INDEX idx_audit_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at);

-- ============================================================
-- SECURITY EVENTS
-- ============================================================
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOGIN HISTORY
-- ============================================================
CREATE TABLE login_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_type VARCHAR(20) DEFAULT 'password',
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info JSONB DEFAULT '{}',
    location JSONB DEFAULT '{}',
    is_successful BOOLEAN DEFAULT true,
    failure_reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEVICE SESSIONS
-- ============================================================
CREATE TABLE device_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES admin_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_settings (key, value, description) VALUES
('maintenance_mode', '{"enabled": false}', 'System maintenance mode'),
('registration_enabled', '{"enabled": true}', 'New user registration'),
('default_otp_settings', '{"transfers": true, "withdrawals": true, "threshold": 500}', 'Default OTP settings for new users'),
('simulation_mode', '{"enabled": true, "message": "DEMO BANKING ENVIRONMENT - No real money is involved."}', 'Simulation mode flag');

-- ============================================================
-- FEES
-- ============================================================
CREATE TABLE fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fee_type VARCHAR(50) NOT NULL,
    currency VARCHAR(3) REFERENCES currencies(code),
    fixed_amount DECIMAL(20,4) DEFAULT 0,
    percentage DECIMAL(5,4) DEFAULT 0,
    min_amount DECIMAL(20,4) DEFAULT 0,
    max_amount DECIMAL(20,4) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO fees (fee_type, currency, fixed_amount, percentage) VALUES
('transfer_domestic', 'USD', 0.50, 0),
('transfer_international', 'USD', 5.00, 0.01),
('currency_conversion', NULL, 0, 0.005),
('withdrawal', 'USD', 1.00, 0),
('card_foreign_transaction', NULL, 0, 0.02);

-- ============================================================
-- PERSONAL FINANCE / BUDGETS
-- ============================================================
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    monthly_limit DECIMAL(20,4) NOT NULL,
    current_spent DECIMAL(20,4) DEFAULT 0,
    month_year VARCHAR(7) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category, month_year)
);

CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(20)
);

INSERT INTO expense_categories (name, icon, color) VALUES
('Food & Dining', '🍽️', '#FF6B6B'),
('Transportation', '🚗', '#4ECDC4'),
('Shopping', '🛍️', '#45B7D1'),
('Bills & Utilities', '📱', '#96CEB4'),
('Entertainment', '🎬', '#FFEAA7'),
('Healthcare', '🏥', '#DDA0DD'),
('Education', '📚', '#98D8C8'),
('Travel', '✈️', '#F7DC6F'),
('Other', '📌', '#BDC3C7');

-- ============================================================
-- FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ACC' || LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_reference()
RETURNS TEXT AS $$
BEGIN
    RETURN 'TXN' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'TKT-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_adjustment_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'BA-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 1. Enable the crypto extension (required for hashing passwords in SQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Ensure the Super Admin role exists (just in case)
INSERT INTO admin_roles (id, name, description)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Super Admin', 'Full system access')
ON CONFLICT (id) DO NOTHING;

-- 3. Create the new admin user (or update if email already exists)
INSERT INTO admin_users (email, password_hash, first_name, last_name, role_id, is_active)
VALUES (
    'rejoice@bank.com',
    crypt('admin123', gen_salt('bf', 10)), -- This generates a REAL, valid bcrypt hash!
    'Rejoice',
    'Admin',
    'a0000000-0000-0000-0000-000000000001',
    true
)
ON CONFLICT (email) DO UPDATE 
SET 
    password_hash = crypt('admin123', gen_salt('bf', 10)),
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_active = true;

    -- 1. Ensure the admin_roles table and Super Admin role exist
CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

INSERT INTO admin_roles (id, name, description)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Super Admin', 'Full system access')
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure the foreign key constraint exists on admin_users
ALTER TABLE admin_users 
DROP CONSTRAINT IF EXISTS admin_users_role_id_fkey;

ALTER TABLE admin_users 
ADD CONSTRAINT admin_users_role_id_fkey 
FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE RESTRICT;

-- 3. CRITICAL: Force Supabase PostgREST API to reload the schema
-- (Without this, the API won't see the new foreign key and the join will still fail)
NOTIFY pgrst, 'reload schema';

-- 4. Verify the admin exists and the join works
SELECT 
    au.email, 
    au.is_active, 
    LEFT(au.password_hash, 15) as hash_preview, 
    ar.name as role_name 
FROM admin_users au 
LEFT JOIN admin_roles ar ON au.role_id = ar.id 
WHERE au.email = 'rejoice@bank.com';

-- Add freeze_reason column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS freeze_reason TEXT,
ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS frozen_by UUID REFERENCES admin_users(id);

-- Add comment for documentation
COMMENT ON COLUMN users.freeze_reason IS 'Reason provided by admin when freezing the account';
COMMENT ON COLUMN users.frozen_at IS 'Timestamp when account was frozen';
COMMENT ON COLUMN users.frozen_by IS 'Admin ID who froze the account';

-- Check if transfer_limits table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'transfer_limits'
);

-- If it doesn't exist, create it
CREATE TABLE IF NOT EXISTS transfer_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    single_transfer_min DECIMAL(20,4) DEFAULT 1,
    single_transfer_max DECIMAL(20,4) DEFAULT 50000,
    daily_transfer_limit DECIMAL(20,4) DEFAULT 100000,
    weekly_transfer_limit DECIMAL(20,4) DEFAULT 500000,
    monthly_transfer_limit DECIMAL(20,4) DEFAULT 2000000,
    daily_transfer_count INTEGER DEFAULT 50,
    weekly_transfer_count INTEGER DEFAULT 200,
    monthly_transfer_count INTEGER DEFAULT 500,
    single_withdrawal_min DECIMAL(20,4) DEFAULT 10,
    single_withdrawal_max DECIMAL(20,4) DEFAULT 10000,
    daily_withdrawal_limit DECIMAL(20,4) DEFAULT 20000,
    weekly_withdrawal_limit DECIMAL(20,4) DEFAULT 50000,
    monthly_withdrawal_limit DECIMAL(20,4) DEFAULT 200000,
    daily_withdrawal_count INTEGER DEFAULT 10,
    weekly_withdrawal_count INTEGER DEFAULT 30,
    monthly_withdrawal_count INTEGER DEFAULT 100,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure every user has a transfer_limits record
INSERT INTO transfer_limits (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM transfer_limits)
ON CONFLICT (user_id) DO NOTHING;


-- Run this in the Supabase SQL editor before deploying the public contact endpoint.
-- Allows support_tickets / support_messages to exist without a signed-in user.

ALTER TABLE support_tickets
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

ALTER TABLE support_messages
  ALTER COLUMN sender_id DROP NOT NULL;

-- Optional but recommended: index for looking up a guest's tickets by email later
CREATE INDEX IF NOT EXISTS idx_support_tickets_guest_email
  ON support_tickets (guest_email)
  WHERE is_guest = TRUE;

  -- ============================================================
-- SIGNUP FLOW REBUILD — additive migration
-- Run in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).
-- Does not touch existing rows' meaning: existing users default to
-- registration_status='active' / signup_stage=5 so nobody already
-- registered gets sent back into the signup wizard.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- 'in_progress' | 'email_pending' | 'active' | 'suspended' | 'closed'
  ADD COLUMN IF NOT EXISTS email_verification_code_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_verification_last_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_stage INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_users_registration_status ON users (registration_status);

-- Sanity constraint: keep registration_status to known values only
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_registration_status_check;
ALTER TABLE users ADD CONSTRAINT users_registration_status_check
  CHECK (registration_status IN ('in_progress', 'email_pending', 'active', 'suspended', 'closed'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_signup_stage_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_signup_stage_check
  CHECK (signup_stage BETWEEN 1 AND 5);