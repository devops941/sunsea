import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Card, Spinner } from "react-bootstrap";
import { FaSave, FaTrash, FaCheckCircle, FaStar } from "react-icons/fa";
import { toast } from "react-toastify";
// adjust path to match where this file actually lives
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import FileUpload from "../../../components/form/FileUpload/FileUpload";
import TextInput from "../../../components/form/TextInput/TextInput";
import Checkbox from "../../../components/form/CheckboxInput/CheckboxInput";
import apiClient from "../../../api/apiClient";

interface ProductImage {
    id: string;
    productId: string;
    imageUrl: string;
    isPrimary: boolean;
}

// apiClient already has baseURL = VITE_API_URL, so this is just the path under that
const PRODUCT_IMAGES_PATH = "/product-images";

const ProductImageUpload: React.FC = () => {
    const productsMockList = [
        { id: 1, code: "PRD001", name: "Plastic Bucket 20L" },
        { id: 2, code: "PRD002", name: "Plastic Mug" },
        { id: 3, code: "PRD003", name: "Storage Container" },
    ];

    const [selectedProductId, setSelectedProductId] = useState<number>(productsMockList[0].id);
    const [imageTitle, setImageTitle] = useState("");
    const [isPrimary, setIsPrimary] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    const [allImages, setAllImages] = useState<ProductImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const activeImages = (allImages ?? []).filter(img => Number(img.productId) === selectedProductId);

    const loadImages = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get(PRODUCT_IMAGES_PATH);
            setAllImages(res.data?.data ?? []);
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to load images");
            setAllImages([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadImages();
    }, [loadImages]);

    const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedProductId(Number(e.target.value));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setUploadedFile(e.target.files[0]);
            if (!imageTitle) {
                setImageTitle(e.target.files[0].name.split(".")[0]);
            }
        }
    };

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!uploadedFile) {
            toast.error("Please select a file to upload.");
            return;
        }

        const shouldBePrimary = isPrimary || activeImages.length === 0;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("image", uploadedFile);
            formData.append("productId", String(selectedProductId));
            formData.append("isPrimary", String(shouldBePrimary));

            const res = await apiClient.post(PRODUCT_IMAGES_PATH, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const newImage: ProductImage = res.data.data;

            setAllImages(prev => {
                const updated = shouldBePrimary
                    ? prev.map(img => Number(img.productId) === selectedProductId ? { ...img, isPrimary: false } : img)
                    : prev;
                return [...updated, newImage];
            });

            setUploadedFile(null);
            setImageTitle("");
            setIsPrimary(false);
            toast.success("Image uploaded successfully!");
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteImage = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this image?")) return;

        try {
            await apiClient.delete(`${PRODUCT_IMAGES_PATH}/${id}`);

            setAllImages(prev => {
                const deleted = prev.find(img => img.id === id);
                const updated = prev.filter(img => img.id !== id);
                if (deleted?.isPrimary) {
                    const sibling = updated.find(img => Number(img.productId) === selectedProductId);
                    if (sibling) sibling.isPrimary = true;
                }
                return updated;
            });

            toast.success("Image deleted successfully!");
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to delete image");
        }
    };

    const handleSetPrimary = async (id: string) => {
        try {
            const formData = new FormData();
            formData.append("isPrimary", "true");

            await apiClient.put(`${PRODUCT_IMAGES_PATH}/${id}`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            setAllImages(prev =>
                prev.map(img =>
                    Number(img.productId) === selectedProductId
                        ? { ...img, isPrimary: img.id === id }
                        : img
                )
            );
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to set primary image");
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Product Images Manager</h2>
                                <div className="page-breadcrumb">Home / Product Management / Images</div>
                            </div>
                        </Col>
                    </Row>
                </div>

                <Row className="g-4">
                    {/* Upload Panel */}
                    <Col lg={4} md={12}>
                        <form onSubmit={handleUploadSubmit} className="form-inner">
                            <h4 className="form-title mb-4">Upload New Image</h4>
                            <div className="d-flex flex-column gap-3">
                                <SelectInput
                                    label="SELECT PRODUCT"
                                    name="productSelect"
                                    value={String(selectedProductId)}
                                    options={productsMockList.map(p => ({ value: String(p.id), label: `${p.code} - ${p.name}` }))}
                                    onChange={handleProductChange}
                                />
                                <FileUpload
                                    label="PRODUCT IMAGE"
                                    name="productFile"
                                    required
                                    onChange={handleFileChange}
                                />
                                {uploadedFile && (
                                    <small className="text-success fw-bold d-block mt-1">
                                        Selected: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
                                    </small>
                                )}
                                <TextInput
                                    label="IMAGE LABEL / TITLE"
                                    name="imageTitle"
                                    value={imageTitle}
                                    placeholder="e.g. Front View"
                                    required
                                    onChange={(e) => setImageTitle(e.target.value)}
                                />
                                <Checkbox
                                    label="Set as Primary Image"
                                    name="isPrimary"
                                    checked={isPrimary}
                                    onChange={(e) => setIsPrimary(e.target.checked)}
                                />
                                <div className="mt-2">
                                    <CustomButton
                                        text={uploading ? "Uploading..." : "Upload Image"}
                                        icon={FaSave}
                                        type="submit"
                                        width="100%"
                                        disabled={uploading}
                                    />
                                </div>
                            </div>
                        </form>
                    </Col>

                    {/* Image Gallery */}
                    <Col lg={8} md={12}>
                        <div className="form-inner h-100">
                            <h4 className="form-title mb-4">
                                Image Gallery - {productsMockList.find(p => p.id === selectedProductId)?.name}
                            </h4>
                            {loading ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : activeImages.length > 0 ? (
                                <Row className="g-3">
                                    {activeImages.map(img => (
                                        <Col sm={6} md={4} key={img.id}>
                                            <Card className="border shadow-sm position-relative rounded-3 overflow-hidden h-100">
                                                <div className="ratio ratio-4x3 bg-light">
                                                    <img
                                                        src={import.meta.env.VITE_IMAGE_URL + img.imageUrl}
                                                        alt="Product"
                                                        style={{ objectFit: "cover", width: "100%", height: "150px" }}
                                                    />
                                                </div>
                                                {img.isPrimary && (
                                                    <span
                                                        className="position-absolute top-0 start-0 m-2 badge bg-warning text-dark d-flex align-items-center gap-1"
                                                        title="Primary Image"
                                                    >
                                                        <FaStar /> Primary
                                                    </span>
                                                )}
                                                <Card.Body className="p-2 d-flex flex-column justify-content-between">
                                                    <div className="d-flex align-items-center justify-content-between mt-auto pt-2 border-top">
                                                        <button
                                                            type="button"
                                                            className={`btn btn-sm ${img.isPrimary ? "btn-outline-secondary disabled" : "btn-outline-primary"}`}
                                                            onClick={() => handleSetPrimary(img.id)}
                                                        >
                                                            Set Primary
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger border-0"
                                                            onClick={() => handleDeleteImage(img.id)}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                            ) : (
                                <div className="text-center py-5 text-muted">
                                    <FaCheckCircle size={40} className="mb-3 text-secondary" />
                                    <p className="mb-0">No images uploaded for this product yet.</p>
                                </div>
                            )}
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default ProductImageUpload;