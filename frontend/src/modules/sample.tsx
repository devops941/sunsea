import React, { useState } from "react";
import { Row, Col } from "react-bootstrap";
import UOMSelect from "../components/form/SelectInput/UOMSelect";

import { FiArrowRight } from "react-icons/fi";
import CustomButton from "../components/ui/Button/Button";

import ViewButton from "../components/ui/viewbutton/ViewButton";
import EditButton from "../components/ui/EditButton/EditButton";
import DeleteButton from "../components/ui/DeleteButton/DeleteButton";



import {
  FiSave,
  FiEdit,
  FiTrash2,
  FiEye,
  FiDownload,
  FiPlus,
  FiSearch,
  FiSettings,
} from "react-icons/fi";




import TextInput from "../components/form/TextInput/TextInput";
import TextArea from "../components/form/TextArea/TextArea";
import SelectInput from "../components/form/SelectInput/SelectInput";
import DateInput from "../components/form/DateInput/DateInput";
import Checkbox from "../components/form/CheckboxInput/CheckboxInput";
import RadioGroup from "../components/form/RadioInput/RadioInput";
import FileUpload from "../components/form/FileUpload/FileUpload";

import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUserTag,
} from "react-icons/fa";

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    email: "",
    customerType: "",
    joiningDate: "",
    address: "",
    gender: "",
    isActive: false,
    sampleUom: "",
  });


  const handleView = () => {
    console.log("View Clicked");
  };

  const handleEdit = () => {
    console.log("Edit Clicked");
  };

  const handleDelete = () => {
    console.log("Delete Clicked");
  };



  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const handleChange = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files?.length) {
      setSelectedFile(event.target.files[0]);
    }
  };

  return (

    <div className="container-fluid mt-4">

      {/* ===============================
    form datas
================================  */}

      <div className="bg-white p-4 rounded shadow-sm">

        <Row className="g-3">

          {/* ===============================
        SECTION HEADER
    =============================== */}

          <div className="form-title-wrap">
            <h2 className="form-title">
              Basic Information
            </h2>
          </div>

          {/* ===============================
        CUSTOMER DETAILS
         =============================== */}

          <Col lg={4} md={6}>
            <TextInput
              label="Customer Name"
              name="customerName"
              value={formData.customerName}
              placeholder="Enter Customer Name"
              icon={<FaUser />}
              required
              onChange={handleChange}
            />
          </Col>

          <Col lg={4} md={6}>
            <TextInput
              label="Phone Number"
              name="phone"
              value={formData.phone}
              placeholder="Enter Phone Number"
              icon={<FaPhone />}
              required
              onChange={handleChange}
            />
          </Col>

          <Col lg={4} md={6}>
            <TextInput
              label="Email Address"
              name="email"
              value={formData.email}
              placeholder="Enter Email Address"
              icon={<FaEnvelope />}
              onChange={handleChange}
            />
          </Col>

          {/* ===============================
        CUSTOMER TYPE & JOINING DATE
    =============================== */}

          <Col lg={4} md={6}>
            <SelectInput
              label="Customer Type"
              name="customerType"
              value={formData.customerType}
              icon={<FaUserTag />}
              required
              options={[
                {
                  label: "Retail",
                  value: "retail",
                },
                {
                  label: "Wholesale",
                  value: "wholesale",
                },
                {
                  label: "Corporate",
                  value: "corporate",
                },
              ]}
              onChange={handleChange}
            />
          </Col>

          <Col lg={4} md={6}>
            <DateInput
              label="Joining Date"
              name="joiningDate"
              value={formData.joiningDate}
              icon={<FaCalendarAlt />}
              required
              onChange={handleChange}
            />
          </Col>

          <Col lg={4} md={6}>
            <UOMSelect
              name="sampleUom"
              label="Select Sample UOM"
              value={formData.sampleUom}
              required
              category={["mass", "volume", "length", "area", "time"]}
              allowedCodes={[
                "kg", "g", "ton", "t",
                "l", "ml", "ltr",
                "m", "cm", "mm", "in", "ft",
                "sq_m", "sq_ft", "ac", "ha",
                "s", "min", "h", "d"
              ]}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, sampleUom: value }));
              }}
            />
          </Col>

          {/* ===============================
        DOCUMENT UPLOAD
    =============================== */}

          <Col lg={4} md={6}>
            <FileUpload
              label="Upload Document"
              name="document"
              required
              onChange={handleFileChange}
            />

            {selectedFile && (
              <small className="text-success">
                {selectedFile.name}
              </small>
            )}
          </Col>

          {/* ===============================
        PERSONAL INFORMATION
    =============================== */}

          <Col lg={6}>
            <RadioGroup
              label="Gender"
              name="gender"
              value={formData.gender}
              options={[
                {
                  label: "Male",
                  value: "male",
                },
                {
                  label: "Female",
                  value: "female",
                },
                {
                  label: "Other",
                  value: "other",
                },
              ]}
              onChange={handleChange}
            />
          </Col>

          <Col lg={6} className="d-flex align-items-end">
            <Checkbox
              label="Active Customer"
              name="isActive"
              checked={formData.isActive}
              onChange={handleCheckboxChange}
            />
          </Col>

          {/* ===============================
        ADDRESS INFORMATION
    =============================== */}

          <Col lg={12}>
            <TextArea
              label="Address"
              name="address"
              value={formData.address}
              placeholder="Enter Complete Address"
              icon={<FaMapMarkerAlt />}
              rows={4}
              onChange={handleChange}
            />
          </Col>

        </Row>

      </div>



      <div className="d-flex justify-content-center align-items-center gap-3 m-3">

        <CustomButton
          text="Primary"
          icon={FiArrowRight}
          variant="primary"
        />

        <CustomButton
          text="Secondary"
          icon={FiSettings}
          variant="secondary"
        />

        <CustomButton
          text="Success"
          icon={FiSave}
          variant={"success" as any}
        />

        <CustomButton
          text="Warning"
          icon={FiEdit}
          variant={"warning" as any}
        />

        <CustomButton
          text="Danger"
          icon={FiTrash2}
          variant="danger"
        />

        <CustomButton
          text="Info"
          icon={FiEye}
          variant={"info" as any}
        />

        <CustomButton
          text="Outline"
          icon={FiSearch}
          variant={"outline" as any}
        />

        <CustomButton
          text="Ghost"
          icon={FiDownload}
          variant={"ghost" as any}
        />

        <CustomButton
          text="Dark"
          icon={FiPlus}
          variant={"dark" as any}
        />

      </div>



      {/* ===============================
      table
     ================================  */}

      <div className="master-table  mt-4">

        <div className="form-title-wrap">
          <h2 className="form-title">
            Basic Information
          </h2>
        </div>

        <div className="master-table-body">

          <table className="master-data-table">

            <thead>
              <tr>
                <th>CODE</th>
                <th>NAME</th>
                <th>CITY</th>
                <th>GSTIN</th>
                <th>CATEGORY</th>
                <th>PAYMENT</th>
                <th>LEAD TIME</th>
                <th>ON-TIME %</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>

              <tr className="master-data-row">

                <td className="master-data-cell">
                  SUP-0001
                </td>

                <td className="master-data-cell">
                  Indian Oil Corporation (IOC)
                </td>

                <td className="master-data-cell">
                  Chennai
                </td>

                <td className="master-data-cell">
                  33AABC10007A1ZU
                </td>

                <td className="master-data-cell">
                  Raw Polymer Â· HP
                </td>

                <td className="master-data-cell">
                  Net 30
                </td>

                <td className="master-data-cell">
                  7 Days
                </td>

                <td className="master-data-cell performance-success">
                  96%
                </td>

                <td className="master-data-cell">

                  <span className="status-pill status-pill--active">
                    Active
                  </span>

                </td>

                <td className="master-data-cell">

                  <div className="table-action-group">

                    <ViewButton
                      onClick={handleView}
                    />

                    <EditButton
                      onClick={handleEdit}
                    />

                    <DeleteButton
                      onClick={handleDelete}
                    />

                  </div>

                </td>

              </tr>

              <tr className="master-data-row">

                <td className="master-data-cell">
                  SUP-0001
                </td>

                <td className="master-data-cell">
                  Indian Oil Corporation (IOC)
                </td>

                <td className="master-data-cell">
                  Chennai
                </td>

                <td className="master-data-cell">
                  33AABC10007A1ZU
                </td>

                <td className="master-data-cell">
                  Raw Polymer Â· HP
                </td>

                <td className="master-data-cell">
                  Net 30
                </td>

                <td className="master-data-cell">
                  7 Days
                </td>

                <td className="master-data-cell performance-success">
                  96%
                </td>

                <td className="master-data-cell">

                  <span className="status-pill status-pill--active">
                    Active
                  </span>

                </td>

                <td className="master-data-cell">

                  <div className="table-action-group">

                    <ViewButton
                      onClick={handleView}
                    />

                    <EditButton
                      onClick={handleEdit}
                    />

                    <DeleteButton
                      onClick={handleDelete}
                    />

                  </div>

                </td>

              </tr>

              <tr className="master-data-row">

                <td className="master-data-cell">
                  SUP-0001
                </td>

                <td className="master-data-cell">
                  Indian Oil Corporation (IOC)
                </td>

                <td className="master-data-cell">
                  Chennai
                </td>

                <td className="master-data-cell">
                  33AABC10007A1ZU
                </td>

                <td className="master-data-cell">
                  Raw Polymer Â· HP
                </td>

                <td className="master-data-cell">
                  Net 30
                </td>

                <td className="master-data-cell">
                  7 Days
                </td>

                <td className="master-data-cell performance-success">
                  96%
                </td>

                <td className="master-data-cell">

                  <span className="status-pill status-pill--active">
                    Active
                  </span>

                </td>

                <td className="master-data-cell">

                  <div className="table-action-group">

                    <ViewButton
                      onClick={handleView}
                    />

                    <EditButton
                      onClick={handleEdit}
                    />

                    <DeleteButton
                      onClick={handleDelete}
                    />

                  </div>

                </td>

              </tr>




            </tbody>

          </table>

        </div>

      </div>


    </div>
  );
};

export default Login;