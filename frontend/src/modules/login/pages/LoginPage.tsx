import { useState, useEffect } from "react";
import Logo from "../../../assets/images/sun-sea.webp";
import { useNavigate, useLocation } from "react-router-dom";
import { FaEye, FaEyeSlash, FaEnvelope, FaLock } from "react-icons/fa";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { loginUser } from "../../../features/auth/authSlice";
import { fetchCompany } from "../../../features/company/companySlice";
import TextInput from "../../../components/form/TextInput/TextInput";
import Button from "../../../components/ui/Button/Button";

const LoginPage = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    const { isLoading: reduxLoading } = useAppSelector((state) => state.auth);
    const { data: company } = useAppSelector((state) => state.company);

    useEffect(() => {
        if (!company) {
            dispatch(fetchCompany());
        }
    }, [dispatch, company]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [localLoading, setLocalLoading] = useState(false);

    // Field-specific validation errors
    const [validationErrors, setValidationErrors] = useState({
        email: "",
        password: ""
    });

    // Server/General error
    const [serverError, setServerError] = useState("");

    const loading = localLoading || reduxLoading;

    const validateForm = () => {
        let isValid = true;
        const errors = { email: "", password: "" };

        if (!email.trim()) {
            errors.email = "Email Address is required";
            isValid = false;
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                errors.email = "Please enter a valid email address";
                isValid = false;
            }
        }

        if (!password) {
            errors.password = "Password is required";
            isValid = false;
        } else if (password.length < 4) {
            errors.password = "Password must be at least 4 characters";
            isValid = false;
        }

        setValidationErrors(errors);
        return isValid;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError("");

        if (!validateForm()) {
            return;
        }

        try {
            setLocalLoading(true);

            const resultAction = await dispatch(loginUser({ email: email.trim(), password }));

            if (loginUser.fulfilled.match(resultAction)) {
                const user = resultAction.payload;
                toast.success(`Welcome back, ${user?.fullName || "User"}`);

                const locationState = location.state as { from?: any } | null;
                const fromPath = "/dashboard";

                navigate(fromPath, { replace: true });
            } else {
                const message = resultAction.payload as string || "Invalid email or password";
                setServerError(message);
                toast.error(message);
            }
        } catch (err: any) {
            const message = err?.message || "An unexpected error occurred";
            setServerError(message);
            toast.error(message);
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">

            {/* ── LEFT BRANDING PANEL ── */}
            <div
                className="hidden lg:flex lg:w-1/2 xl:w-[55%] min-h-screen flex-col justify-center relative overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #1a3a8f 0%, #1e4db7 45%, #1565c0 100%)",
                }}
            >
                {/* Before effect: top-left circle */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        top: "-180px",
                        left: "-180px",
                        width: "480px",
                        height: "480px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.06)",
                        border: "60px solid rgba(255,255,255,0.05)",
                    }}
                />

                {/* After effect: bottom-right circle */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        bottom: "-160px",
                        right: "-120px",
                        width: "400px",
                        height: "400px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.05)",
                        border: "50px solid rgba(255,255,255,0.04)",
                    }}
                />

                {/* Diagonal stripes */}
                <div
                    className="absolute pointer-events-none inset-0"
                    style={{
                        background:
                            "repeating-linear-gradient(120deg, transparent, transparent 120px, rgba(255,255,255,0.018) 120px, rgba(255,255,255,0.018) 240px)",
                    }}
                />

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full px-12 xl:px-16">
                    {/* Logo bar */}


                    <div className="flex-1 flex flex-col justify-center">
                        <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] mb-5 tracking-tight">
                            Welcome to<br />
                            Sun Sea ERP
                        </h1>

                        <p className="text-blue-100 text-base leading-relaxed max-w-[540px] opacity-80">
                            Empowering your manufacturing journey. Gain complete control over your production, inventory, and supply chain from a single, intelligent platform.
                        </p>
                    </div>

                    {/* Copyright */}
                    <p className="text-blue-200 text-xs opacity-50 pb-10">
                        © {new Date().getFullYear()} {company?.companyName || "SunSea"} ERP. All rights reserved.
                    </p>
                </div>
            </div>

            {/* ── RIGHT LOGIN PANEL ── */}
            <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-white px-6 sm:px-10 lg:px-12 xl:px-16">

                {/* Mobile logo */}
                <div className="lg:hidden mb-8 flex flex-col items-center">
                    <img
                        src={company?.logoUrl || Logo}
                        alt="SunSea"
                        className="h-12 object-contain"
                    />
                </div>

                <div className="w-full max-w-[400px]">
                    {/* Heading */}
                    <div className="mb-8">
                        <h2 className="text-[2rem] font-black leading-tight mb-2 bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent">
                            Welcome Back!
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Sign in to your account to continue managing operations.
                        </p>
                    </div>

                    {/* General Server Error Message */}
                    {serverError && (
                        <div className="mb-5 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
                            {serverError}
                        </div>
                    )}

                    {/* ── FORM ── */}
                    <form onSubmit={handleLogin} className="space-y-4" noValidate>

                        {/* Email Address */}
                        <TextInput
                            label="Email Address"
                            name="email"
                            type="text"
                            value={email}
                            placeholder="you@sunsea.com"
                            required
                            icon={<FaEnvelope />}
                            disabled={loading}
                            autoComplete="username"
                            error={validationErrors.email}
                            inputClassName="login-input !bg-white !text-slate-900 !border-slate-300 focus:!border-blue-600 focus:!ring-blue-600/20 placeholder:!text-slate-400 font-semibold"
                            labelClassName="!text-slate-700 font-extrabold"
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setValidationErrors(prev => ({ ...prev, email: "" }));
                                setServerError("");
                            }}
                        />

                        {/* Password */}
                        <TextInput
                            label="Password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            placeholder="Enter your password"
                            required
                            icon={<FaLock />}
                            disabled={loading}
                            autoComplete="current-password"
                            error={validationErrors.password}
                            inputClassName="login-input !bg-white !text-slate-900 !border-slate-300 focus:!border-blue-600 focus:!ring-blue-600/20 placeholder:!text-slate-400 font-semibold"
                            labelClassName="!text-slate-700 font-extrabold"
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setValidationErrors(prev => ({ ...prev, password: "" }));
                                setServerError("");
                            }}
                            trailingIcon={
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    disabled={loading}
                                    tabIndex={-1}
                                    className="text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                </button>
                            }
                        />

                        {/* Forgot password */}
                        {/* <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={() => navigate("/reset")}
                                disabled={loading}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors focus:outline-none"
                            >
                                Forgot password?{" "}
                                <span className="underline underline-offset-2">Click here</span>
                            </button>
                        </div> */}

                        {/* Submit Button */}
                        <div className="pt-2">
                            <Button
                                text={loading ? "Signing In..." : "Login Now"}
                                type="submit"
                                size="lg"
                                variant="primary"
                                width="100%"
                                disabled={loading}
                                className="!bg-gradient-to-r !from-blue-700 !to-blue-500 hover:!from-blue-800 hover:!to-blue-600 !shadow-md !shadow-blue-500/20"
                            />
                        </div>
                    </form>

                </div>
            </div>
        </div>
    );
};

export default LoginPage;