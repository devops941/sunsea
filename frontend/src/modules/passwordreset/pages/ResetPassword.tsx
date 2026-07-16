import { useNavigate } from "react-router-dom";
import { FaLock } from "react-icons/fa";

const ResetPassword = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.06)] border border-slate-200">
                <div className="p-8 sm:p-10 flex flex-col justify-center">
                    
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <FaLock className="text-2xl text-primary" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2 tracking-tight">
                            Reset Password
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-base">
                            Enter your new password below.
                        </p>
                    </div>

                    {/* Form */}
                    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                placeholder="Enter new password"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-white transition-all duration-200 font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                placeholder="Confirm new password"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-white transition-all duration-200 font-medium"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate("/login")}
                            className="w-full mt-6 flex items-center justify-center gap-2 bg-primary hover:bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-200"
                        >
                            <span>RESET & SIGN IN</span>
                        </button>
                    </form>
                    
                    <div className="text-center mt-6">
                        <button
                            type="button"
                            onClick={() => navigate("/login")}
                            className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors focus:outline-none"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;