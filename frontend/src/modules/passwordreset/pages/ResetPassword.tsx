import { Container, Row, Col, Form } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import "./Resetpassword.css";
const ResetPassword = () => {
const navigate = useNavigate();


    return (
        <div className="reset-page">

            <Container fluid className="p-0 ">

                <div className="reset-wrapper">
                    <Row className="justify-content-center align-items-center min-vh-100 p-1">
                        <Col xl={6} lg={7} md={8} sm={10} xs={11}>
                            <div className="reset-right">
                                <div className="reset-form-wrap">

                                    <h2 className="reset-title">
                                        Reset Password
                                    </h2>

                                    <p className="reset-subtitle">
                                        reset your password here

                                    </p>

                                    <Form>

                                        <Form.Group className="mb-3">

                                            <Form.Label>
                                                Password
                                            </Form.Label>

                                            <Form.Control
                                                type="password"
                                                placeholder="New Password"
                                                required
                                            />

                                        </Form.Group>

                                        <Form.Group className="mb-3">

                                            <Form.Label>
                                                confirm Password
                                            </Form.Label>

                                            <Form.Control
                                                type="password"
                                                placeholder="Confirm password"
                                                required
                                            />

                                        </Form.Group>




                                        <button
                                            type="button"
                                            className="reset-btn"
                                            onClick={() => navigate("/login")}
                                        >
                                            <span>RESET & SIGN IN</span>


                                        </button>

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

export default ResetPassword;