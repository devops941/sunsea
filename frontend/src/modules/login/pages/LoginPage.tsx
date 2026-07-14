import { useState } from "react";
import { Container, Row, Col, Form } from "react-bootstrap";
import "./Login.css";
import Logo from "../../../assets/images/sun-sea.webp"
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowRight, FaEye, FaEyeSlash } from "react-icons/fa";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { loginUser } from "../../../features/auth/authSlice";

const LoginPage = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    
    const { isLoading: reduxLoading } = useAppSelector((state) => state.auth);
    
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
        <div className="login-page">

            <Container fluid className="p-0">

                <div className="login-wrapper">

                    <Row className="g-0">

                        {/* Left Section */}
                        <Col lg={6} md={6} >
                            <div className="login-left">


                                <div className="login-brand">

                                    <div className="brand-logo">
                                        <img
                                            src={Logo}
                                            alt="Logo"
                                            className="logo-img"
                                        />
                                    </div>

                                    <div>
                                        <h5>SUN SEA</h5>
                                        <span>
                                            INDUSTRIES · MADURAI
                                        </span>
                                    </div>

                                </div>

                                <div className="login-left-content">

                                    <h1>
                                        Plastic Manufacturing,
                                        <br />
                                        <span>
                                            Run Like Software.
                                        </span>
                                    </h1>

                                    <p>
                                        One ERP across Sales, Production,
                                        Stores, Procurement, Finance —
                                        with an offline-first mobile app
                                        for field collection agents.
                                    </p>



                                </div>


                            </div>





                        </Col>

                        {/* Right Section */}

                        <Col lg={6} md={6} >
                            <div className="login-right">
                                <div className="login-form-wrap">

                                    <h2 className="login-title">
                                        Sign in to your workspace
                                    </h2>

                                    <p className="login-subtitle">
                                        Enter your credentials to continue.
                                    </p>

                                    <Form onSubmit={handleLogin}>

                                        {error && (
                                            <div className="alert alert-danger py-2" role="alert">
                                                {error}
                                            </div>
                                        )}

                                        <Form.Group className="mb-3">

                                            <Form.Label>
                                                Username or Email
                                            </Form.Label>

                                            <Form.Control
                                                type="text"
                                                placeholder="Enter username or email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                disabled={loading}
                                            />

                                        </Form.Group>

                                        <Form.Group className="mb-3">

                                            <Form.Label>
                                                Password
                                            </Form.Label>

                                            <div className="position-relative d-flex align-items-center">
                                                <Form.Control
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Enter password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    disabled={loading}
                                                    className="pe-5"
                                                />
                                                <button
                                                    type="button"
                                                    className="position-absolute border-0 bg-transparent text-muted d-flex align-items-center justify-content-center"
                                                    style={{ right: "12px", zIndex: 10, cursor: "pointer", outline: "none" }}
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    tabIndex={-1}
                                                    title={showPassword ? "Hide password" : "Show password"}
                                                >
                                                    {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                                                </button>
                                            </div>

                                        </Form.Group>




                                        <button
                                            type="submit"
                                            className="login-btn"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <span className="d-flex align-items-center justify-content-center gap-2">
                                                    <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-4 w-4 border-b-2"></div>
                                                    Signing In...
                                                </span>
                                            ) : (
                                                <>
                                                    <span>Sign In to ERP</span>
                                                    <FaArrowRight className="login-btn-icon" />
                                                </>
                                            )}
                                        </button>

                                        <div className="text-center mt-3">
                                            <button
                                                type="button"
                                                className="btn btn-link text-decoration-none text-muted"
                                                onClick={() => navigate("/reset")}
                                                disabled={loading}
                                            >
                                                Forgot Password?
                                            </button>
                                        </div>
                                    </Form>

                                </div>
                            </div>

                        </Col>

                    </Row>

                </div>

            </Container>

        </div>
    );
};

export default LoginPage;