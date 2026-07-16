import { useState, useEffect } from "react";
import Logo from "../../../assets/images/logo.png"
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowRight, FaEye, FaEyeSlash } from "react-icons/fa";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { loginUser } from "../../../features/auth/authSlice";
import { fetchCompany } from "../../../features/company/companySlice";

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
    const [error, setError] = useState("");

    const loading = localLoading || reduxLoading;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            setError("Please fill in all fields");
            return;
        }

        try {
            setLocalLoading(true);
            setError("");

            const resultAction = await dispatch(loginUser({ email, password }));

            if (loginUser.fulfilled.match(resultAction)) {
                const user = resultAction.payload;
                toast.success(`Welcome back, ${user?.fullName || "User"}`);

                const locationState = location.state as { from?: any } | null;
                const fromPath = locationState?.from?.pathname || locationState?.from || "/dashboard";

                navigate(fromPath, { replace: true });
            } else {
                const message = resultAction.payload as string || "Invalid email or password";
                setError(message);
                toast.error(message);
            }
        } catch (err: any) {
            const message = err?.message || "An unexpected error occurred";
            setError(message);
            toast.error(message);
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 relative overflow-hidden">
            {/* Premium decorative background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]"></div>
                <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-[100px]"></div>
            </div>

            <div className="w-full max-w-[600px] bg-white/80 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/60 relative z-10 p-10 sm:p-12">

                {/* Large Centered Logo */}
                <div className="flex justify-center mb-10">
                    <div className="w-64 sm:w-80 drop-shadow-2xl transition-transform hover:scale-105 duration-500">
                        <img
                            src={company?.logoUrl || Logo}
                            alt="Company Logo"
                            className="w-full h-auto object-contain"
                        />
                    </div>
                </div>

                <div className="text-center mb-10">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-2">
                        Welcome Back
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">
                        Sign in to access your workspace
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50/80 text-red-600 text-sm rounded-2xl border border-red-100 font-medium flex items-center shadow-sm">
                            <span className="mr-3 text-lg">⚠️</span> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
                            Email Address
                        </label>
                        <input
                            type="text"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            className="w-full px-5 py-4 rounded-2xl border-0 bg-slate-100/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all duration-300 font-medium shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                className="w-full px-5 py-4 pr-12 rounded-2xl border-0 bg-slate-100/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all duration-300 font-medium shadow-inner"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                disabled={loading}
                                tabIndex={-1}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary focus:outline-none transition-colors p-2"
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-2xl shadow-[0_8px_20px_-6px_rgba(var(--color-primary-rgb),0.5)] hover:shadow-[0_12px_25px_-6px_rgba(var(--color-primary-rgb),0.6)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                                    <span>Signing In...</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-base tracking-wide">Sign In</span>
                                    <FaArrowRight className="text-sm opacity-90" />
                                </>
                            )}
                        </button>
                    </div>

                    <div className="text-center mt-8">
                        <button
                            type="button"
                            onClick={() => navigate("/reset")}
                            disabled={loading}
                            className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors focus:outline-none underline decoration-transparent hover:decoration-primary underline-offset-4"
                        >
                            Forgot your password?
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;