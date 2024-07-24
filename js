import { LightningElement, track } from 'lwc';
import getLeadData from '@salesforce/apex/LeadController.getLeadData';
import pdflib from "@salesforce/resourceUrl/pdflib";
import docxImport from "@salesforce/resourceUrl/docx"; 
import { loadScript } from 'lightning/platformResourceLoader';

const columns = [
    { label: 'Date', fieldName: 'CreatedDate', type: 'date' },
    { label: 'Name', fieldName: 'Name', type: 'text' },
    { label: 'Call Source', fieldName: 'Call_Source__c', type: 'text' },
    { label: 'Sub Source', fieldName: 'Sub_source__c', type: 'text' },
    { label: 'Status', fieldName: 'Legal_Status_New__c', type: 'text' },
    { label: 'Details', fieldName: 'Description', type: 'text' }
];

const additionalFields = [
    'Date_of_Accident__c',
    'Incident_Location__c',
    'Case_Type__c',
    'Lawyer__c',
    'Legal_Status__c',
    'Client_Sign_Up_Method_1__c',
    'commercial_or_minimal_policy__c',
    'How_is_it_commercial__c',
    'Medical_Status__c',
    'Reason__c',
    'MIC__c',
    'What_is_the_MIC__c',
    'How_did_the_client_hear_about_us__c'
];
const fieldLabels = {
    Date_of_Accident__c: 'Date of Accident',
    Incident_Location__c: 'Incident Location',
    Case_Type__c: 'Case Type',
    Lawyer__c: 'Lawyer',
    Legal_Status__c: 'Legal Status',
    Client_Sign_Up_Method_1__c: 'Client Sign Up Method',
    commercial_or_minimal_policy__c: 'Commercial or Minimal Policy',
    How_is_it_commercial__c: 'How is it Commercial',
    Medical_Status__c: 'Medical Status',
    Reason__c: 'Reason',
    MIC__c: 'MIC',
    What_is_the_MIC__c: 'What is the MIC',
    How_did_the_client_hear_about_us__c: 'How did the client hear about us',
    Legal_Status_Reason__c: 'Legal Status Reason',
    DNU_Referring_lawyer__c: 'DNU Referring Lawyer'
};

export default class LeadDataGrid extends LightningElement {
    leads = [];
    title = "Showing Yesterday Lead data";
    groupedLeads = [];
    columns = columns;
    error;
    @track selectedFilter = 'YESTERDAY';
    @track filterOptions = [
        { label: 'Today', value: 'TODAY' },
        { label: 'Yesterday', value: 'YESTERDAY' },
        { label: 'Last 7 Days', value: 'LAST_7_DAYS' },
        { label: 'Last 30 Days', value: 'LAST_30_DAYS' },
        { label: 'This Week', value: 'THIS_WEEK' },
        { label: 'Last Week', value: 'LAST_WEEK' },
        { label: 'This Month', value: 'THIS_MONTH' },
        { label: 'Last Month', value: 'LAST_MONTH' },
        { label: 'This Year', value: 'THIS_YEAR' },
        { label: 'Last Year', value: 'LAST_YEAR' },
    ];

    pdfLibLoaded = false;
    docxLibLoaded = false;
    selectedLabel = 'Yesterday';
    hasLeads = false;
    isLoading = false;
    isExportDisabled = true;

    

    handleFilterChange(event) {
        this.selectedFilter = event.detail.value;
        this.selectedLabel = this.filterOptions.find(option => option.value === this.selectedFilter)?.label;
      
        this.title = 'Showing ' + this.selectedLabel + ' Lead data';
        this.fetchLeadData();
    }

    fetchLeadData() {
        this.isLoading = true;
        getLeadData({ dateFilter: this.selectedFilter })
            .then(result => {
                this.groupedLeads = this.groupByCallSourceAndOwner(result);
            
                this.hasLeads = this.groupedLeads.length > 0;
                this.isExportDisabled = !this.hasLeads;
                this.isLoading = false;
            })
            .catch(error => {
               
                this.hasLeads = false;
                this.isExportDisabled = true;
                this.isLoading = false;
            });
    }
     handleMenuSelect(event) {
        const selectedAction = event.detail.value;
        if (selectedAction === 'pdf') {
            this.downloadPdf();
        } else if (selectedAction === 'doc') {
            this.handleDownloadDocument();
        }
    }

 
//Working code 

groupByCallSourceAndOwner(leads) {
    const grouped = {};
    const lawyerTotals = {};
    const sourceTotals = {};
    

    leads.forEach(lead => {
        const callSource = lead.Call_Source__c || 'N/A';
        const subSource = lead.Sub_source__c || 'N/A';
        const ownerName = lead.Owner.Name || 'N/A';
        const lawyerName = lead.Lawyer__r ? lead.Lawyer__r.Name : 'No Lawyer Assigned';

        // Deep copy the lead to avoid mutating the original object
        const sanitizedLead = JSON.parse(JSON.stringify(lead));
        delete sanitizedLead.Lawyer__c;
        if (sanitizedLead.Lawyer__r) {
            delete sanitizedLead.Lawyer__r.Id;
        }


        if (!grouped[callSource]) {
            grouped[callSource] = {};
        }
        if (!grouped[callSource][subSource]) {
            grouped[callSource][subSource] = {};
        }
        if (!grouped[callSource][subSource][ownerName]) {
            grouped[callSource][subSource][ownerName] = { ownerName, leads: [] };
        }
        grouped[callSource][subSource][ownerName].leads.push(sanitizedLead);

        if (!lawyerTotals[lawyerName]) {
            lawyerTotals[lawyerName] = 0;
        }
        lawyerTotals[lawyerName]++;

        if(!sourceTotals[callSource])
        {
            sourceTotals[callSource] = 0;
        }
        sourceTotals[callSource]++;
    });

    const result = [];
    for (const callSource in grouped) {
        const subGroups = [];
        for (const subSource in grouped[callSource]) {
            const owners = [];
            for (const owner in grouped[callSource][subSource]) {
                owners.push(grouped[callSource][subSource][owner]);
            }
            subGroups.push({ subSource, owners });
        }
        result.push({ callSource, subGroups });
    }

    this.lawyerTotals = lawyerTotals; // Store the lawyer totals for later use
    this.sourceTotals = sourceTotals;

    return result;
}



    renderedCallback() {
        if (this.pdfLibLoaded && this.docxLibLoaded) {
            return;
        }
        loadScript(this, pdflib)
            .then(() => {
                this.pdfLibLoaded = true;
            })
            .catch(error => {
            });
      
    }



   /* wrapText(text, maxWidth, fontSize, font) {
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const textWidth = font.widthOfTextAtSize(testLine, fontSize);

            if (textWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }*/

    truncateText(text, maxWidth, fontSize, font) {
        let truncatedText = text;
        let textWidth = font.widthOfTextAtSize(truncatedText, fontSize);
        
        while (textWidth > maxWidth) {
            truncatedText = truncatedText.slice(0, -1);
            textWidth = font.widthOfTextAtSize(truncatedText + '...', fontSize);
        }

        if (truncatedText !== text) {
            truncatedText += '...';
        }

        return truncatedText;
    }




//working code 
/*
async downloadPdf() {
    if (!this.pdfLibLoaded) {
        return;
    }

    try {
        const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

        const pageWidth = 1000;
        const pageHeight = 792;
        const margin = 50;
        const fontSize = 12;
        const userSeparationSpace = 30;
        const headerHeight = 30;
        const labelValuePadding = 5;
        const additionalSpaceAfterLine = 30;

        let page = pdfDoc.addPage([pageWidth, pageHeight]);
        const { width, height } = page.getSize();
        const columnWidths = [200, 200, 200];
        const additionalColumnWidth = 300;

        let yPosition = height - margin;

        const headingText = `${this.selectedLabel} Report by Screener`;
        const headingWidth = timesRomanFont.widthOfTextAtSize(headingText, 20);
        const xCenter = (width - headingWidth) / 2;

        const legalStatusFilterValues = [
            'Lawyer assigned - under evaluation',
            'Lawyer assigned - pending sign-up',
            'Lawyer Assigned',
            'Retained'
        ];

        const addPageIfNeeded = (requiredHeight) => {
            if (yPosition - requiredHeight <= margin) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = height - margin;
            }
        };

        page.drawText(headingText, {
            x: xCenter,
            y: yPosition,
            size: 20,
            font: timesRomanBoldFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 30;

        const now = new Date();
        const formattedDateTime = now.toLocaleString();
        const dateText = `${formattedDateTime}`;

        const dateTextWidth = timesRomanFont.widthOfTextAtSize(dateText, fontSize);
        const dateTextX = width - margin - dateTextWidth;
        const dateTextY = height - margin;

        page.drawText(dateText, {
            x: dateTextX,
            y: dateTextY,
            size: fontSize,
            font: timesRomanFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 30;

        const drawHeaders = () => {
            const headers = ['Date', 'Client Name', 'Status'];
            let xPosition = margin;
            headers.forEach((header, index) => {
                page.drawText(header, {
                    x: xPosition,
                    y: yPosition,
                    size: fontSize,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });
                xPosition += columnWidths[index];
            });

            page.drawText('Additional Details', {
                x: xPosition,
                y: yPosition,
                size: fontSize,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0)
            });

            yPosition -= headerHeight;
        };

        const fieldLabels = {
            Date_of_Accident__c: 'Date of Accident',
            Incident_Location__c: 'Incident Location',
            Case_Type__c: 'Case Type',
            Lawyer__c: 'Lawyer',
            Client_Sign_Up_Method_1__c: 'Client Sign Up Method',
            commercial_or_minimal_policy__c: 'Commercial or Minimal Policy',
            How_is_it_commercial__c: 'How is it Commercial',
            Medical_Status__c: 'Medical Status',
            Reason__c: 'Reason',
            MIC__c: 'MIC',
            What_is_the_MIC__c: 'What is the MIC',
            How_did_the_client_hear_about_us__c: 'How did the client hear about us',
            Legal_Status_Reason__c: 'Legal Status Reason',
            DNU_Referring_lawyer__c: 'DNU Referring Lawyer'
        };

        const drawCallSourceAndOwner = (group, subGroup, ownerGroup) => {
        const requiredHeight = 60; // Estimated height needed for this section
        addPageIfNeeded(requiredHeight);

        if (group.callSource !== currentSource) {
            currentSource = group.callSource;
            const callSourceText = `Call Source: ${group.callSource || 'Unknown'}`;
            const callSourceTextWidth = timesRomanBoldFont.widthOfTextAtSize(callSourceText, 18);
            const xCenter = (width - callSourceTextWidth) / 2;

    page.drawText(callSourceText, {
                x: xCenter,
                y: yPosition,
                size: 18,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0.5)
            });

            yPosition -= 20;
        }

        page.drawText(`Sub Source: ${subGroup.subSource || 'Unknown'}`, {
            x: margin,
            y: yPosition,
            size: 16,
            font: timesRomanBoldFont,
            color: rgb(0, 0, 0.5)
        });

        yPosition -= 20;

        page.drawText(`Owner: ${ownerGroup.ownerName || 'Unknown'}`, {
            x: margin,
            y: yPosition,
            size: 14,
            font: timesRomanBoldFont,
            color: rgb(1, 0, 0)
        });

        yPosition -= 20;
    };


        const drawLawyerTotals = (ownerGroup) => {
            const lawyerTotals = {};

            ownerGroup.leads.forEach((lead) => {
                const lawyerName = lead.Lawyer__r ? lead.Lawyer__r.Name : 'No Lawyer Assigned';
                if (!lawyerTotals[lawyerName]) {
                    lawyerTotals[lawyerName] = 0;
                }
                lawyerTotals[lawyerName]++;
            });

            if (Object.keys(lawyerTotals).length > 0) {
                const requiredHeight = 40 + Object.keys(lawyerTotals).length * 20; // Estimated height for lawyer totals
                addPageIfNeeded(requiredHeight);

                page.drawText('TOTALS PER LAWYERS', {
                    x: margin,
                    y: yPosition,
                    size: 16,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });

                yPosition -= 20;

                Object.keys(lawyerTotals).forEach(lawyer => {
                    page.drawText(`${lawyer} : ${lawyerTotals[lawyer]}`, {
                        x: margin,
                        y: yPosition,
                        size: 14,
                        font: timesRomanFont,
                        color: rgb(0, 0, 0)
                    });

                    yPosition -= 20;
                });
            }
        };

        const drawSourceTotals = (ownerGroup) => {
            const sourceTotals = {};

            ownerGroup.leads.forEach((lead) => {
                const sourceName = lead.Call_Source__c ? lead.Call_Source__c : 'N/A';
                if (!sourceTotals[sourceName]) {
                    sourceTotals[sourceName] = 0;
                }
                sourceTotals[sourceName]++;
            });

            if (Object.keys(sourceTotals).length > 0) {
                const requiredHeight = 40 + Object.keys(sourceTotals).length * 20; // Estimated height for source totals
                addPageIfNeeded(requiredHeight);

                page.drawText('TOTALS PER USER', {
                    x: margin,
                    y: yPosition,
                    size: 16,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });

                yPosition -= 20;

                Object.keys(sourceTotals).forEach(source => {
                    page.drawText(`${source} : ${sourceTotals[source]}`, {
                        x: margin,
                        y: yPosition,
                        size: 14,
                        font: timesRomanFont,
                        color: rgb(0, 0, 0)
                    });

                    yPosition -= 20;
                });
            }
        };
    const drawSourceTotals1 = (source, count) => {
        yPosition -= 5;
        page.drawText(`TOTALS PER SOURCE (${source}) : ${count}`, {
            x: margin,
            y: yPosition,
            size: 16,
            font: timesRomanBoldFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 20;
    };


        let currentSource = null;
        let currentSourceCount = 0;

        this.groupedLeads.forEach((group, groupIndex) => {
            if (groupIndex > 0) {
                yPosition -= userSeparationSpace;
            }

            group.subGroups.forEach((subGroup, subGroupIndex) => {
                if (subGroupIndex > 0) {
                    yPosition -= userSeparationSpace;
                }

                subGroup.owners.forEach((ownerGroup, ownerIndex) => {
                    if (ownerIndex > 0) {
                        yPosition -= userSeparationSpace;
                    }

                    drawCallSourceAndOwner(group, subGroup, ownerGroup);
                    drawHeaders();

                    ownerGroup.leads.forEach((lead, leadIndex) => {
                        if (currentSource !== lead.Call_Source__c) {
                            if (currentSource !== null) {
                                // Draw total for the previous source before starting the new one
                               // drawSourceTotals1(currentSource, currentSourceCount);
                            }
                            currentSource = lead.Call_Source__c;
                            currentSourceCount = 0;
                        }

                        currentSourceCount++;

                        const requiredHeight = 20 + Math.max(20, Object.keys(fieldLabels).length * 20) + additionalSpaceAfterLine; // Estimated height for each lead
                        addPageIfNeeded(requiredHeight);

                        const formattedDate = new Date(lead.CreatedDate).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric'
                        });

                        let xPosition = margin;
                        page.drawText(formattedDate, {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });

                        xPosition += columnWidths[0];
                        page.drawText(lead.Name || '', {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });
    //starting
        xPosition += columnWidths[1];
        page.drawText(lead.Legal_Status_New__c || 'N/A', {
            x: xPosition,
            y: yPosition,
            size: fontSize,
            font: timesRomanFont,
            color: rgb(0, 0, 0)
        });

        let additionalFieldsXPosition = margin + columnWidths.reduce((acc, curr, index) => acc + (index < columnWidths.length ? curr : 0), 0) + 20;
        additionalFieldsXPosition -= 20;

        let additionalFieldsYPosition = yPosition;
        Object.keys(fieldLabels).forEach((field, fieldIndex) => {
            let fieldValue = lead[field] ? lead[field].toString() : 'N/A';
            let fieldLabel = fieldLabels[field];

            // Handle displaying Lawyer name specifically
            if (field === 'Lawyer__c' && lead.Lawyer__r && lead.Lawyer__r.Name) {
                fieldValue = lead.Lawyer__r.Name;
            }

            page.drawText(`${fieldLabel}:`, {
                x: additionalFieldsXPosition,
                y: additionalFieldsYPosition,
                size: fontSize,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0)
            });

            const labelWidth = timesRomanBoldFont.widthOfTextAtSize(`${fieldLabel}:`, fontSize);

            // Wrap the text for the 'Additional Details' field
            const maxWidth = additionalColumnWidth - labelWidth - labelValuePadding;
            const wrappedText = this.wrapText(fieldValue, maxWidth, fontSize, timesRomanFont);

            wrappedText.forEach((line, index) => {
                page.drawText(line, {
                    x: additionalFieldsXPosition + labelWidth + labelValuePadding,
                    y: additionalFieldsYPosition - (index * 20),
                    size: fontSize,
                    font: timesRomanFont,
                    color: rgb(0, 0, 0)
                });
            });

            additionalFieldsYPosition -= (wrappedText.length * 20);
        });

        yPosition -= Math.max(20, Object.keys(fieldLabels).length * 20);

        // Draw a horizontal line after each lead
        yPosition -= 10;
        page.drawLine({
            start: { x: margin, y: yPosition },
            end: { x: width - margin, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        yPosition -= additionalSpaceAfterLine;
        });
                //end

                drawLawyerTotals(ownerGroup); // Draw totals for this owner
                drawSourceTotals(ownerGroup);
            });
        });

        
            drawSourceTotals1(currentSource, currentSourceCount);

            currentSourceCount = 0;
    });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `${this.selectedLabel}_Report.pdf`;
        link.click();
    } catch (error) {
        console.error('Error generating PDF:', error);
    }
}
*/
//issue solved 
/*
async downloadPdf() {
    if (!this.pdfLibLoaded) {
        return;
    }

    try {
        const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

        const pageWidth = 1000;
        const pageHeight = 792;
        const margin = 50;
        const fontSize = 12;
        const userSeparationSpace = 30;
        const headerHeight = 30;
        const labelValuePadding = 5;
        const additionalSpaceAfterLine = 30;

        let page = pdfDoc.addPage([pageWidth, pageHeight]);
        const { width, height } = page.getSize();
        const columnWidths = [200, 200, 200];
        const additionalColumnWidth = 300;

        let yPosition = height - margin;

        const headingText = `${this.selectedLabel} Report by Screener`;
        const headingWidth = timesRomanFont.widthOfTextAtSize(headingText, 20);
        const xCenter = (width - headingWidth) / 2;

        const addPageIfNeeded = (requiredHeight) => {
            if (yPosition - requiredHeight <= margin) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = height - margin;
            }
        };

        page.drawText(headingText, {
            x: xCenter,
            y: yPosition,
            size: 20,
            font: timesRomanBoldFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 30;

        const now = new Date();
        const formattedDateTime = now.toLocaleString();
        const dateText = `${formattedDateTime}`;

        const dateTextWidth = timesRomanFont.widthOfTextAtSize(dateText, fontSize);
        const dateTextX = width - margin - dateTextWidth;
        const dateTextY = height - margin;

        page.drawText(dateText, {
            x: dateTextX,
            y: dateTextY,
            size: fontSize,
            font: timesRomanFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 30;

        const drawHeaders = () => {
            const headers = ['Date', 'Client Name', 'Status'];
            let xPosition = margin;
            headers.forEach((header, index) => {
                page.drawText(header, {
                    x: xPosition,
                    y: yPosition,
                    size: fontSize,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });
                xPosition += columnWidths[index];
            });

            page.drawText('Additional Details', {
                x: xPosition,
                y: yPosition,
                size: fontSize,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0)
            });

            yPosition -= headerHeight;
        };

        const fieldLabels = {
            Date_of_Accident__c: 'Date of Accident',
            Incident_Location__c: 'Incident Location',
            Case_Type__c: 'Case Type',
            Lawyer__c: 'Lawyer',
            Client_Sign_Up_Method_1__c: 'Client Sign Up Method',
            commercial_or_minimal_policy__c: 'Commercial or Minimal Policy',
            How_is_it_commercial__c: 'How is it Commercial',
            Medical_Status__c: 'Medical Status',
            Reason__c: 'Reason',
            MIC__c: 'MIC',
            What_is_the_MIC__c: 'What is the MIC',
            How_did_the_client_hear_about_us__c: 'How did the client hear about us',
            Legal_Status_Reason__c: 'Legal Status Reason',
            DNU_Referring_lawyer__c: 'DNU Referring Lawyer'
        };

        const drawCallSourceAndOwner = (group, subGroup, ownerGroup) => {
            let requiredHeight = 60; // Estimated height needed for this section
            addPageIfNeeded(requiredHeight);

            if (group.callSource !== currentSource) {
                currentSource = group.callSource;
                const callSourceText = `Call Source: ${group.callSource || 'Unknown'}`;
                const callSourceTextWidth = timesRomanBoldFont.widthOfTextAtSize(callSourceText, 18);
                const xCenter = (width - callSourceTextWidth) / 2;

                page.drawText(callSourceText, {
                    x: xCenter,
                    y: yPosition,
                    size: 18,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0.5)
                });

                yPosition -= 20;
            }

            page.drawText(`Sub Source: ${subGroup.subSource || 'Unknown'}`, {
                x: margin,
                y: yPosition,
                size: 16,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0.5)
            });

            yPosition -= 20;

            page.drawText(`Owner: ${ownerGroup.ownerName || 'Unknown'}`, {
                x: margin,
                y: yPosition,
                size: 14,
                font: timesRomanBoldFont,
                color: rgb(1, 0, 0)
            });

            yPosition -= 20;
        };

        const drawLawyerTotals = (ownerGroup) => {
            const lawyerTotals = {};

            ownerGroup.leads.forEach((lead) => {
                const lawyerName = lead.Lawyer__r ? lead.Lawyer__r.Name : 'No Lawyer Assigned';
                if (!lawyerTotals[lawyerName]) {
                    lawyerTotals[lawyerName] = 0;
                }
                lawyerTotals[lawyerName]++;
            });

            if (Object.keys(lawyerTotals).length > 0) {
                let totalHeight = 40 + Object.keys(lawyerTotals).length * 20; // Estimated height for lawyer totals
                addPageIfNeeded(totalHeight);

                page.drawText('TOTALS PER LAWYERS', {
                    x: margin,
                    y: yPosition,
                    size: 16,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });

                yPosition -= 20;

                Object.keys(lawyerTotals).forEach(lawyer => {
                    page.drawText(`${lawyer} : ${lawyerTotals[lawyer]}`, {
                        x: margin,
                        y: yPosition,
                        size: 14,
                        font: timesRomanFont,
                        color: rgb(0, 0, 0)
                    });

                    yPosition -= 20;
                });
            }
        };

        const drawSourceTotals = (ownerGroup) => {
            const sourceTotals = {};

            ownerGroup.leads.forEach((lead) => {
                const sourceName = lead.Call_Source__c ? lead.Call_Source__c : 'N/A';
                if (!sourceTotals[sourceName]) {
                    sourceTotals[sourceName] = 0;
                }
                sourceTotals[sourceName]++;
            });

            if (Object.keys(sourceTotals).length > 0) {
                let totalHeight = 40 + Object.keys(sourceTotals).length * 20; // Estimated height for source totals
                addPageIfNeeded(totalHeight);

                page.drawText('TOTALS PER USER', {
                    x: margin,
                    y: yPosition,
                    size: 16,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });

                yPosition -= 20;

                Object.keys(sourceTotals).forEach(source => {
                    page.drawText(`${source} : ${sourceTotals[source]}`, {
                        x: margin,
                        y: yPosition,
                        size: 14,
                        font: timesRomanFont,
                        color: rgb(0, 0, 0)
                    });

                    yPosition -= 20;
                });
            }
        };

        const drawSourceTotals1 = (source, count) => {
            yPosition -= 5;
            page.drawText(`TOTALS PER SOURCE (${source}) : ${count}`, {
                x: margin,
                y: yPosition,
                size: 16,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0)
            });

            yPosition -= 20;
        };

        let currentSource = null;
        let currentSourceCount = 0;

        this.groupedLeads.forEach((group, groupIndex) => {
            if (groupIndex > 0) {
                yPosition -= userSeparationSpace;
            }

            group.subGroups.forEach((subGroup, subGroupIndex) => {
                if (subGroupIndex > 0) {
                    yPosition -= userSeparationSpace;
                }

                subGroup.owners.forEach((ownerGroup, ownerIndex) => {
                    if (ownerIndex > 0) {
                        yPosition -= userSeparationSpace;
                    }

                    drawCallSourceAndOwner(group, subGroup, ownerGroup);
                    drawHeaders();

                    ownerGroup.leads.forEach((lead, leadIndex) => {
                        if (currentSource !== lead.Call_Source__c) {
                            if (currentSource !== null) {
                                drawSourceTotals1(currentSource, currentSourceCount);
                            }
                            currentSource = lead.Call_Source__c;
                            currentSourceCount = 0;
                        }

                        currentSourceCount++;

                        const leadDateWidth = timesRomanFont.widthOfTextAtSize(new Date(lead.CreatedDate).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric'
                        }), fontSize);

                        const additionalFieldsWidth = columnWidths.reduce((acc, curr) => acc + curr, 0) + 20;
                        let additionalFieldsHeight = 0;

                        Object.keys(fieldLabels).forEach((field) => {
                            let fieldValue = lead[field] ? lead[field].toString() : 'N/A';
                            const fieldLabel = fieldLabels[field];

                            if (field === 'Lawyer__c' && lead.Lawyer__r && lead.Lawyer__r.Name) {
                                fieldValue = lead.Lawyer__r.Name;
                            }

                            const labelWidth = timesRomanBoldFont.widthOfTextAtSize(`${fieldLabel}:`, fontSize);
                            const maxWidth = additionalColumnWidth - labelWidth - labelValuePadding;
                            const wrappedText = this.wrapText(fieldValue, maxWidth, fontSize, timesRomanFont);

                            additionalFieldsHeight += wrappedText.length * 20;
                        });

                        const requiredHeight = 20 + Math.max(20, Object.keys(fieldLabels).length * 20) + additionalFieldsHeight + additionalSpaceAfterLine;
                        addPageIfNeeded(requiredHeight);

                        const formattedDate = new Date(lead.CreatedDate).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric'
                        });

                        let xPosition = margin;
                        page.drawText(formattedDate, {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });

                        xPosition += columnWidths[0];
                        page.drawText(lead.Name || '', {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });

                        xPosition += columnWidths[1];
                        page.drawText(lead.Legal_Status_New__c || 'N/A', {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });

                        let additionalFieldsXPosition = margin + columnWidths.reduce((acc, curr) => acc + curr, 0) + 20;
                        additionalFieldsXPosition -= 20;

                        let additionalFieldsYPosition = yPosition;
                        Object.keys(fieldLabels).forEach((field) => {
                            let fieldValue = lead[field] ? lead[field].toString() : 'N/A';
                            const fieldLabel = fieldLabels[field];

                            if (field === 'Lawyer__c' && lead.Lawyer__r && lead.Lawyer__r.Name) {
                                fieldValue = lead.Lawyer__r.Name;
                            }

                            page.drawText(`${fieldLabel}:`, {
                                x: additionalFieldsXPosition,
                                y: additionalFieldsYPosition,
                                size: fontSize,
                                font: timesRomanBoldFont,
                                color: rgb(0, 0, 0)
                            });

                            const labelWidth = timesRomanBoldFont.widthOfTextAtSize(`${fieldLabel}:`, fontSize);

                            // Wrap the text for the 'Additional Details' field
                            const maxWidth = additionalColumnWidth - labelWidth - labelValuePadding;
                            const wrappedText = this.wrapText(fieldValue, maxWidth, fontSize, timesRomanFont);

                            wrappedText.forEach((line, index) => {
                                page.drawText(line, {
                                    x: additionalFieldsXPosition + labelWidth + labelValuePadding,
                                    y: additionalFieldsYPosition - (index * 20),
                                    size: fontSize,
                                    font: timesRomanFont,
                                    color: rgb(0, 0, 0)
                                });
                            });

                            additionalFieldsYPosition -= (wrappedText.length * 20);
                        });

                        yPosition -= Math.max(20, Object.keys(fieldLabels).length * 20) + additionalFieldsHeight;

                        // Draw a horizontal line after each lead
                        yPosition -= 10;
                        page.drawLine({
                            start: { x: margin, y: yPosition },
                            end: { x: width - margin, y: yPosition },
                            thickness: 1,
                            color: rgb(0, 0, 0)
                        });
                        yPosition -= additionalSpaceAfterLine;
                    });

                    drawLawyerTotals(ownerGroup); // Draw totals for this owner
                    drawSourceTotals(ownerGroup);
                });
            });

            drawSourceTotals1(currentSource, currentSourceCount);

            currentSourceCount = 0;
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `${this.selectedLabel}_Report.pdf`;
        link.click();
    } catch (error) {
        console.error('Error generating PDF:', error);
    }
}*/

/*
async downloadPdf() {
    if (!this.pdfLibLoaded) {
        return;
    }

    try {
        const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

        const pageWidth = 1000;
        const pageHeight = 792;
        const margin = 50;
        const fontSize = 12;
        const userSeparationSpace = 30;
        const headerHeight = 30;
        const labelValuePadding = 5;
        const lineHeight = 20;
        const additionalSpaceAfterLine = 30;

        let page = pdfDoc.addPage([pageWidth, pageHeight]);
        const { width, height } = page.getSize();
        const columnWidths = [200, 200, 200];
        const additionalColumnWidth = 300;

        let yPosition = height - margin;

        const headingText = `${this.selectedLabel} Report by Screener`;
        const headingWidth = timesRomanFont.widthOfTextAtSize(headingText, 20);
        const xCenter = (width - headingWidth) / 2;

        const legalStatusFilterValues = [
            'Lawyer assigned - under evaluation',
            'Lawyer assigned - pending sign-up',
            'Lawyer Assigned',
            'Retained'
        ];

        const addPageIfNeeded = (requiredHeight) => {
            if (yPosition - requiredHeight <= margin) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = height - margin;
            }
        };

        page.drawText(headingText, {
            x: xCenter,
            y: yPosition,
            size: 20,
            font: timesRomanBoldFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 30;

        const now = new Date();
        const formattedDateTime = now.toLocaleString();
        const dateText = `${formattedDateTime}`;

        const dateTextWidth = timesRomanFont.widthOfTextAtSize(dateText, fontSize);
        const dateTextX = width - margin - dateTextWidth;
        const dateTextY = height - margin;

        page.drawText(dateText, {
            x: dateTextX,
            y: dateTextY,
            size: fontSize,
            font: timesRomanFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 30;

        const drawHeaders = () => {
            const headers = ['Date', 'Client Name', 'Status'];
            let xPosition = margin;
            headers.forEach((header, index) => {
                page.drawText(header, {
                    x: xPosition,
                    y: yPosition,
                    size: fontSize,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });
                xPosition += columnWidths[index];
            });

            page.drawText('Additional Details', {
                x: xPosition,
                y: yPosition,
                size: fontSize,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0)
            });

            yPosition -= headerHeight;
        };

        const fieldLabels = {
            Date_of_Accident__c: 'Date of Accident',
            Incident_Location__c: 'Incident Location',
            Case_Type__c: 'Case Type',
            Lawyer__c: 'Lawyer',
            Client_Sign_Up_Method_1__c: 'Client Sign Up Method',
            commercial_or_minimal_policy__c: 'Commercial or Minimal Policy',
            How_is_it_commercial__c: 'How is it Commercial',
            Medical_Status__c: 'Medical Status',
            Reason__c: 'Reason',
            MIC__c: 'MIC',
            What_is_the_MIC__c: 'What is the MIC',
            How_did_the_client_hear_about_us__c: 'How did the client hear about us',
            Legal_Status_Reason__c: 'Legal Status Reason',
            DNU_Referring_lawyer__c: 'DNU Referring Lawyer'
        };

        const drawCallSourceAndOwner = (group, subGroup, ownerGroup) => {
            const requiredHeight = 60; // Estimated height needed for this section
            addPageIfNeeded(requiredHeight);

            if (group.callSource !== currentSource) {
                currentSource = group.callSource;
                const callSourceText = `Call Source: ${group.callSource || 'Unknown'}`;
                const callSourceTextWidth = timesRomanBoldFont.widthOfTextAtSize(callSourceText, 18);
                const xCenter = (width - callSourceTextWidth) / 2;

                page.drawText(callSourceText, {
                    x: xCenter,
                    y: yPosition,
                    size: 18,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0.5)
                });

                yPosition -= 20;
            }

            page.drawText(`Sub Source: ${subGroup.subSource || 'Unknown'}`, {
                x: margin,
                y: yPosition,
                size: 16,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0.5)
            });

            yPosition -= 20;

            page.drawText(`Owner: ${ownerGroup.ownerName || 'Unknown'}`, {
                x: margin,
                y: yPosition,
                size: 14,
                font: timesRomanBoldFont,
                color: rgb(1, 0, 0)
            });

            yPosition -= 20;
        };

        const drawLawyerTotals = (ownerGroup) => {
            const lawyerTotals = {};

            ownerGroup.leads.forEach((lead) => {
                const lawyerName = lead.Lawyer__r ? lead.Lawyer__r.Name : 'No Lawyer Assigned';
                if (!lawyerTotals[lawyerName]) {
                    lawyerTotals[lawyerName] = 0;
                }
                lawyerTotals[lawyerName]++;
            });

            if (Object.keys(lawyerTotals).length > 0) {
                const requiredHeight = 40 + Object.keys(lawyerTotals).length * 20; // Estimated height for lawyer totals
                addPageIfNeeded(requiredHeight);

                page.drawText('TOTALS PER LAWYERS', {
                    x: margin,
                    y: yPosition,
                    size: 16,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });

                yPosition -= 20;

                Object.keys(lawyerTotals).forEach(lawyer => {
                    page.drawText(`${lawyer} : ${lawyerTotals[lawyer]}`, {
                        x: margin,
                        y: yPosition,
                        size: 14,
                        font: timesRomanFont,
                        color: rgb(0, 0, 0)
                    });

                    yPosition -= 20;
                });
            }
        };

        const drawSourceTotals = (ownerGroup) => {
            const sourceTotals = {};

            ownerGroup.leads.forEach((lead) => {
                const sourceName = lead.Call_Source__c ? lead.Call_Source__c : 'N/A';
                if (!sourceTotals[sourceName]) {
                    sourceTotals[sourceName] = 0;
                }
                sourceTotals[sourceName]++;
            });

            if (Object.keys(sourceTotals).length > 0) {
                const requiredHeight = 40 + Object.keys(sourceTotals).length * 20; // Estimated height for source totals
                addPageIfNeeded(requiredHeight);

                page.drawText('TOTALS PER USER', {
                    x: margin,
                    y: yPosition,
                    size: 16,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });

                yPosition -= 20;

                Object.keys(sourceTotals).forEach(source => {
                    page.drawText(`${source} : ${sourceTotals[source]}`, {
                        x: margin,
                        y: yPosition,
                        size: 14,
                        font: timesRomanFont,
                        color: rgb(0, 0, 0)
                    });

                    yPosition -= 20;
                });
            }
        };

        const drawSourceTotals1 = (source, count) => {
            yPosition -= 5;
            page.drawText(`TOTALS PER SOURCE (${source}) : ${count}`, {
                x: margin,
                y: yPosition,
                size: 16,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0)
            });

            yPosition -= 20;
        };

        let currentSource = null;
        let currentSourceCount = 0;

        this.groupedLeads.forEach((group, groupIndex) => {
            if (groupIndex > 0) {
                yPosition -= userSeparationSpace;
            }

            group.subGroups.forEach((subGroup, subGroupIndex) => {
                if (subGroupIndex > 0) {
                    yPosition -= userSeparationSpace;
                }

                subGroup.owners.forEach((ownerGroup, ownerIndex) => {
                    if (ownerIndex > 0) {
                        yPosition -= userSeparationSpace;
                    }

                    drawCallSourceAndOwner(group, subGroup, ownerGroup);
                    drawHeaders();

                    ownerGroup.leads.forEach((lead, leadIndex) => {
                        if (currentSource !== lead.Call_Source__c) {
                            if (currentSource !== null) {
                                drawSourceTotals1(currentSource, currentSourceCount);
                            }
                            currentSource = lead.Call_Source__c;
                            currentSourceCount = 0;
                        }

                        currentSourceCount++;

                        let requiredHeight = 20 + Math.max(20, Object.keys(fieldLabels).length * 20) + additionalSpaceAfterLine;

                        Object.keys(fieldLabels).forEach((field) => {
                            const fieldValue = lead[field] ? lead[field].toString() : 'N/A';
                            const maxWidth = additionalColumnWidth - timesRomanBoldFont.widthOfTextAtSize(`${fieldLabels[field]}:`, fontSize) - labelValuePadding;
                            const wrappedText = this.wrapText(fieldValue, maxWidth, fontSize, timesRomanFont);
                            requiredHeight += wrappedText.length * lineHeight;
                        });

                        addPageIfNeeded(requiredHeight);

                        const formattedDate = new Date(lead.CreatedDate).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric'
                        });

                        let xPosition = margin;
                        page.drawText(formattedDate, {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });

                        xPosition += columnWidths[0];
                        page.drawText(lead.Name || '', {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });

                        xPosition += columnWidths[1];
                        page.drawText(lead.Legal_Status_New__c || 'N/A', {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });

                        let additionalFieldsXPosition = margin + columnWidths.reduce((acc, curr, index) => acc + (index < columnWidths.length ? curr : 0), 0) + 20;
                        additionalFieldsXPosition -= 20;

                        let additionalFieldsYPosition = yPosition;
                        Object.keys(fieldLabels).forEach((field, fieldIndex) => {
                            let fieldValue = lead[field] ? lead[field].toString() : 'N/A';
                            let fieldLabel = fieldLabels[field];

                            if (field === 'Lawyer__c' && lead.Lawyer__r && lead.Lawyer__r.Name) {
                                fieldValue = lead.Lawyer__r.Name;
                            }

                            page.drawText(`${fieldLabel}:`, {
                                x: additionalFieldsXPosition,
                                y: additionalFieldsYPosition,
                                size: fontSize,
                                font: timesRomanBoldFont,
                                color: rgb(0, 0, 0)
                            });

                            const labelWidth = timesRomanBoldFont.widthOfTextAtSize(`${fieldLabel}:`, fontSize);

                            const maxWidth = additionalColumnWidth - labelWidth - labelValuePadding;
                            const wrappedText = this.wrapText(fieldValue, maxWidth, fontSize, timesRomanFont);

                            wrappedText.forEach((line, index) => {
                                page.drawText(line, {
                                    x: additionalFieldsXPosition + labelWidth + labelValuePadding,
                                    y: additionalFieldsYPosition - (index * 20),
                                    size: fontSize,
                                    font: timesRomanFont,
                                    color: rgb(0, 0, 0)
                                });
                            });

                            additionalFieldsYPosition -= (wrappedText.length * lineHeight);
                        });

                        yPosition -= requiredHeight;

                        yPosition -= 20;
                        page.drawLine({
                            start: { x: margin, y: yPosition },
                            end: { x: width - margin, y: yPosition },
                            thickness: 1,
                            color: rgb(0, 0, 0)
                        });
                        yPosition -= additionalSpaceAfterLine;
                    });

                    drawLawyerTotals(ownerGroup);
                    drawSourceTotals(ownerGroup);
                });
            });

            drawSourceTotals1(currentSource, currentSourceCount);
            currentSourceCount = 0;
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `${this.selectedLabel}_Report.pdf`;
        link.click();
    } catch (error) {
        console.error('Error generating PDF:', error);
    }
}
*/

//Testing

async downloadPdf() {
    if (!this.pdfLibLoaded) {
        return;
    }

    try {
        const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

        const pageWidth = 1000;
        const pageHeight = 792;
        const margin = 50;
        const fontSize = 12;
        const userSeparationSpace = 30;
        const headerHeight = 30;
        const labelValuePadding = 5;
        const additionalSpaceAfterLine = 30;

        let page = pdfDoc.addPage([pageWidth, pageHeight]);
        const { width, height } = page.getSize();
        const columnWidths = [200, 200, 200];
        const additionalColumnWidth = 300;

        let yPosition = height - margin;

        const headingText = `${this.selectedLabel} Report by Screener`;
        const headingWidth = timesRomanFont.widthOfTextAtSize(headingText, 20);
        const xCenter = (width - headingWidth) / 2;

        const legalStatusFilterValues = [
            'Lawyer assigned - under evaluation',
            'Lawyer assigned - pending sign-up',
            'Lawyer Assigned',
            'Retained'
        ];

        const addPageIfNeeded = (requiredHeight) => {
            if (yPosition - requiredHeight <= margin) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = height - margin;
            }
        };

        page.drawText(headingText, {
            x: xCenter,
            y: yPosition,
            size: 20,
            font: timesRomanBoldFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 30;

        const now = new Date();
        const formattedDateTime = now.toLocaleString();
        const dateText = `${formattedDateTime}`;

        const dateTextWidth = timesRomanFont.widthOfTextAtSize(dateText, fontSize);
        const dateTextX = width - margin - dateTextWidth;
        const dateTextY = height - margin;

        page.drawText(dateText, {
            x: dateTextX,
            y: dateTextY,
            size: fontSize,
            font: timesRomanFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 30;

        const drawHeaders = () => {
            const headers = ['Date', 'Client Name', 'Status'];
            let xPosition = margin;
            headers.forEach((header, index) => {
                page.drawText(header, {
                    x: xPosition,
                    y: yPosition,
                    size: fontSize,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });
                xPosition += columnWidths[index];
            });

            page.drawText('Additional Details', {
                x: xPosition,
                y: yPosition,
                size: fontSize,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0)
            });

            yPosition -= headerHeight;
        };

        const fieldLabels = {
            Date_of_Accident__c: 'Date of Accident',
            Incident_Location__c: 'Incident Location',
            Case_Type__c: 'Case Type',
            Lawyer__c: 'Lawyer',
            Client_Sign_Up_Method_1__c: 'Client Sign Up Method',
            commercial_or_minimal_policy__c: 'Commercial or Minimal Policy',
            How_is_it_commercial__c: 'How is it Commercial',
            Medical_Status__c: 'Medical Status',
            Reason__c: 'Reason',
            MIC__c: 'MIC',
            What_is_the_MIC__c: 'What is the MIC',
            How_did_the_client_hear_about_us__c: 'How did the client hear about us',
            Legal_Status_Reason__c: 'Legal Status Reason',
            DNU_Referring_lawyer__c: 'DNU Referring Lawyer'
        };

        const drawCallSourceAndOwner = (group, subGroup, ownerGroup) => {
        const requiredHeight = 60; // Estimated height needed for this section
        addPageIfNeeded(requiredHeight);

        if (group.callSource !== currentSource) {
            currentSource = group.callSource;
            const callSourceText = `Call Source: ${group.callSource || 'Unknown'}`;
            const callSourceTextWidth = timesRomanBoldFont.widthOfTextAtSize(callSourceText, 18);
            const xCenter = (width - callSourceTextWidth) / 2;

    page.drawText(callSourceText, {
                x: xCenter,
                y: yPosition,
                size: 18,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0.5)
            });

            yPosition -= 20;
        }

        page.drawText(`Sub Source: ${subGroup.subSource || 'Unknown'}`, {
            x: margin,
            y: yPosition,
            size: 16,
            font: timesRomanBoldFont,
            color: rgb(0, 0, 0.5)
        });

        yPosition -= 20;

        page.drawText(`Owner: ${ownerGroup.ownerName || 'Unknown'}`, {
            x: margin,
            y: yPosition,
            size: 14,
            font: timesRomanBoldFont,
            color: rgb(1, 0, 0)
        });

        yPosition -= 20;
    };


        const drawLawyerTotals = (ownerGroup) => {
            const lawyerTotals = {};

            ownerGroup.leads.forEach((lead) => {
                const lawyerName = lead.Lawyer__r ? lead.Lawyer__r.Name : 'No Lawyer Assigned';
                if (!lawyerTotals[lawyerName]) {
                    lawyerTotals[lawyerName] = 0;
                }
                lawyerTotals[lawyerName]++;
            });

            if (Object.keys(lawyerTotals).length > 0) {
                const requiredHeight = 40 + Object.keys(lawyerTotals).length * 20; // Estimated height for lawyer totals
                addPageIfNeeded(requiredHeight);

                page.drawText('TOTALS PER LAWYERS', {
                    x: margin,
                    y: yPosition,
                    size: 16,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });

                yPosition -= 20;

                Object.keys(lawyerTotals).forEach(lawyer => {
                    page.drawText(`${lawyer} : ${lawyerTotals[lawyer]}`, {
                        x: margin,
                        y: yPosition,
                        size: 14,
                        font: timesRomanFont,
                        color: rgb(0, 0, 0)
                    });

                    yPosition -= 20;
                });
            }
        };

        const drawSourceTotals = (ownerGroup) => {
            const sourceTotals = {};

            ownerGroup.leads.forEach((lead) => {
                const sourceName = lead.Call_Source__c ? lead.Call_Source__c : 'N/A';
                if (!sourceTotals[sourceName]) {
                    sourceTotals[sourceName] = 0;
                }
                sourceTotals[sourceName]++;
            });

            if (Object.keys(sourceTotals).length > 0) {
                const requiredHeight = 40 + Object.keys(sourceTotals).length * 20; // Estimated height for source totals
                addPageIfNeeded(requiredHeight);

                page.drawText('TOTALS PER USER', {
                    x: margin,
                    y: yPosition,
                    size: 16,
                    font: timesRomanBoldFont,
                    color: rgb(0, 0, 0)
                });

                yPosition -= 20;

                Object.keys(sourceTotals).forEach(source => {
                    page.drawText(`${source} : ${sourceTotals[source]}`, {
                        x: margin,
                        y: yPosition,
                        size: 14,
                        font: timesRomanFont,
                        color: rgb(0, 0, 0)
                    });

                    yPosition -= 20;
                });
            }
        };
    const drawSourceTotals1 = (source, count) => {
        yPosition -= 5;
        page.drawText(`TOTALS PER SOURCE (${source}) : ${count}`, {
            x: margin,
            y: yPosition,
            size: 16,
            font: timesRomanBoldFont,
            color: rgb(0, 0, 0)
        });

        yPosition -= 20;
    };


        let currentSource = null;
        let currentSourceCount = 0;

        this.groupedLeads.forEach((group, groupIndex) => {
            if (groupIndex > 0) {
                yPosition -= userSeparationSpace;
            }

            group.subGroups.forEach((subGroup, subGroupIndex) => {
                if (subGroupIndex > 0) {
                    yPosition -= userSeparationSpace;
                }

                subGroup.owners.forEach((ownerGroup, ownerIndex) => {
                    if (ownerIndex > 0) {
                        yPosition -= userSeparationSpace;
                    }

                    drawCallSourceAndOwner(group, subGroup, ownerGroup);
                    drawHeaders();

                    ownerGroup.leads.forEach((lead, leadIndex) => {
                        if (currentSource !== lead.Call_Source__c) {
                            if (currentSource !== null) {
                                // Draw total for the previous source before starting the new one
                               // drawSourceTotals1(currentSource, currentSourceCount);
                            }
                            currentSource = lead.Call_Source__c;
                            currentSourceCount = 0;
                        }

                        currentSourceCount++;

                        const requiredHeight = 20 + Math.max(20, Object.keys(fieldLabels).length * 20) + additionalSpaceAfterLine; // Estimated height for each lead
                        addPageIfNeeded(requiredHeight);

                        const formattedDate = new Date(lead.CreatedDate).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric'
                        });

                        let xPosition = margin;
                        page.drawText(formattedDate, {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });

                        xPosition += columnWidths[0];
                        page.drawText(lead.Name || '', {
                            x: xPosition,
                            y: yPosition,
                            size: fontSize,
                            font: timesRomanFont,
                            color: rgb(0, 0, 0)
                        });
    //starting
        xPosition += columnWidths[1];
        page.drawText(lead.Legal_Status_New__c || 'N/A', {
            x: xPosition,
            y: yPosition,
            size: fontSize,
            font: timesRomanFont,
            color: rgb(0, 0, 0)
        });

        let additionalFieldsXPosition = margin + columnWidths.reduce((acc, curr, index) => acc + (index < columnWidths.length ? curr : 0), 0) + 20;
        additionalFieldsXPosition -= 20;
        let totalLines = 0;

        let additionalFieldsYPosition = yPosition;
        Object.keys(fieldLabels).forEach((field, fieldIndex) => {
            let fieldValue = lead[field] ? lead[field].toString() : 'N/A';
            let fieldLabel = fieldLabels[field];

            // Handle displaying Lawyer name specifically
            if (field === 'Lawyer__c' && lead.Lawyer__r && lead.Lawyer__r.Name) {
                fieldValue = lead.Lawyer__r.Name;
            }

            page.drawText(`${fieldLabel}:`, {
                x: additionalFieldsXPosition,
                y: additionalFieldsYPosition,
                size: fontSize,
                font: timesRomanBoldFont,
                color: rgb(0, 0, 0)
            });

            const labelWidth = timesRomanBoldFont.widthOfTextAtSize(`${fieldLabel}:`, fontSize);

            // Wrap the text for the 'Additional Details' field
            const maxWidth = additionalColumnWidth - labelWidth - labelValuePadding;
            const wrappedText = this.wrapText(fieldValue, maxWidth, fontSize, timesRomanFont);

            wrappedText.forEach((line, index) => {
                page.drawText(line, {
                    x: additionalFieldsXPosition + labelWidth + labelValuePadding,
                    y: additionalFieldsYPosition - (index * 20),
                    size: fontSize,
                    font: timesRomanFont,
                    color: rgb(0, 0, 0)
                });
            });
             totalLines += wrappedText.length;
            additionalFieldsYPosition -= (wrappedText.length * 20);
        });

       // yPosition -= Math.max(40, Object.keys(fieldLabels).length * 40);
yPosition -= Math.max(30, totalLines * 20);
        // Draw a horizontal line after each lead
        yPosition -= 10;
        page.drawLine({
            start: { x: margin, y: yPosition },
            end: { x: width - margin, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        yPosition -= additionalSpaceAfterLine;
        });
                //end

                drawLawyerTotals(ownerGroup); // Draw totals for this owner
                drawSourceTotals(ownerGroup);
            });
        });

        
            drawSourceTotals1(currentSource, currentSourceCount);

            currentSourceCount = 0;
    });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `${this.selectedLabel}_Report.pdf`;
        link.click();
    } catch (error) {
        console.error('Error generating PDF:', error);
    }
}


wrapText(text, maxWidth, fontSize, font) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach((word) => {
        const testLine = currentLine + word + ' ';
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine.length > 0) {
        lines.push(currentLine.trim());
    }

    return lines;
}

/*
wrapText(text, maxWidth, fontSize, font) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach((word) => {
        const testLine = currentLine + word + ' ';
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine.length > 0) {
        lines.push(currentLine.trim());
    }

    return lines;
}
*/

//working code 
/*
wrapText(text, maxWidth, fontSize, font) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach((word) => {
        const testLine = currentLine + word + ' ';
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine.length > 0) {
        lines.push(currentLine.trim());
    }

    return lines;
}*/




    formatDate(dateString) {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        });
    }

    connectedCallback() {
         loadScript(this, docxImport)
            .then(() => {
               
            })
            .catch(error => {
                
            });
        this.fetchLeadData();
    }


async handleDownloadDocument() {
    if (!this.groupedLeads || this.groupedLeads.length === 0) {
        await this.fetchLeadData(); // Ensure groupedLeads is populated
        if (!this.groupedLeads || this.groupedLeads.length === 0) {
            return;
        }
    }

    // Compute overall totals for each call source
    const callSourceTotalsMap = this.groupedLeads.reduce((map, group) => {
        // Initialize or accumulate totals for the current call source
        map[group.callSource] = (map[group.callSource] || 0) + group.subGroups.reduce((subTotal, subGroup) => {
            return subTotal + subGroup.owners.reduce((ownerTotal, owner) => {
                return ownerTotal + owner.leads.length;
            }, 0);
        }, 0);
        return map;
    }, {});

    // Proceed with document generation
    let htmlContent = '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
                      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
                      'xmlns="http://www.w3.org/TR/REC-html40">' +
                      '<head><meta charset="utf-8"><title>Lead Data</title></head><body>';

    let lastCallSource = ''; // Track the last seen call source

    this.groupedLeads.forEach(group => {
        // Check if the current call source is different from the last seen one
        if (group.callSource !== lastCallSource) {
            // Call Source level
            htmlContent += `<p style="text-align: center; font-weight: bold; font-size: 16px;">Call Source : ${group.callSource}</p>`;
            lastCallSource = group.callSource; // Update the last seen call source
        }

        group.subGroups.forEach(subGroup => {
            // Sub Source level
            htmlContent += this.generateGroupRowHTML(`Sub Source : ${subGroup.subSource}`, false);
            subGroup.owners.forEach(owner => {
                // Owner level
                htmlContent += this.generateGroupRowHTML(`Owner : ${owner.ownerName}`, false);
                // Add the table header row
                htmlContent += this.generateHeaderRowHTML();
                owner.leads.forEach(lead => {
                    // Lead level
                    htmlContent += this.generateRowHTML(lead);
                });
                htmlContent += '</table>'; // Close the table for owner's leads

                // Display lawyer totals for this owner
                const lawyerTotals = this.getLawyerTotals(owner.leads);
                htmlContent += `<p><strong>Totals per Lawyers</strong></p>`;
                Object.keys(lawyerTotals).forEach(lawyer => {
                    htmlContent += `<p>${lawyer} : ${lawyerTotals[lawyer]}</p>`;
                });

                // Display call source totals for the entire dataset
                const sourceTotals = this.getSourceTotals(owner.leads);
                htmlContent += `<p><strong>Totals per User</strong></p>`;
                Object.keys(sourceTotals).forEach(source => {
                    htmlContent += `<p>${source} : ${sourceTotals[source]}</p>`;
                });
            });

            // Display call source totals after the last record of each sub group
            if (subGroup === group.subGroups[group.subGroups.length - 1]) {
                htmlContent += `<p><strong>TOTALS PER SOURCE (${group.callSource}) :</strong> ${callSourceTotalsMap[group.callSource]}</p>`;
            }
        });
    });

    htmlContent += '</body></html>';

    this.downloadDocument(htmlContent);
}





getCallSourceTotals1(groupedLeads) {
    const callSourceTotals = {};

    groupedLeads.forEach(group => {
        group.subGroups.forEach(subGroup => {
            subGroup.owners.forEach(owner => {
                owner.leads.forEach(lead => {
                    const callSource = lead.Call_Source__c || 'Unknown Call Source';

                    if (!callSourceTotals[callSource]) {
                        callSourceTotals[callSource] = 0;
                    }
                    callSourceTotals[callSource]++;
                });
            });
        });
    });
  
    return callSourceTotals;
}

//Get Lawyer Total 
getLawyerTotals(leads) {
    const lawyerTotals = {};

    leads.forEach(lead => {
        const lawyerName = lead.Lawyer__r ? lead.Lawyer__r.Name : 'No Lawyer Assigned';

        if (!lawyerTotals[lawyerName]) {
            lawyerTotals[lawyerName] = 0;
        }
        lawyerTotals[lawyerName]++;
    });

    return lawyerTotals;
}

getSourceTotals(leads)
{
    const sourceTotals = {};

    leads.forEach(lead => {
        const sourceName = lead.Call_Source__c ? lead.Call_Source__c : 'N/A';
        if (!sourceTotals[sourceName]) {
            sourceTotals[sourceName] = 0;
        }
        sourceTotals[sourceName]++;
    });

    return sourceTotals;
}

generateGroupRowHTML(label, isMainGroup) {
    const boldStyle = isMainGroup ? 'font-weight: bold;' : '';
    return `<p style="${boldStyle} font-size: 16px;">${label}</p>`;
}

generateHeaderRowHTML() {
    return `
        <table border="1" style="width: 100%; border-collapse: collapse;">
            <tr>
                <th style="background-color: #4472C4; color: white; padding: 8px;">Lead Name</th>
                <th style="background-color: #4472C4; color: white; padding: 8px;">Date</th>
                <th style="background-color: #4472C4; color: white; padding: 8px;">Status</th>
                <th style="background-color: #4472C4; color: white; padding: 8px;">Additional Details</th>
            </tr>
    `;
}

generateRowHTML(lead) {
    const date = lead.CreatedDate ? new Date(lead.CreatedDate).toLocaleString('en-GB') : '';
    const legalStatus = lead.Legal_Status_New__c || 'N/A';
    const additionalDetails = additionalFields.map(field => {
        const label = fieldLabels[field];
        const value = lead[field] || 'N/A';
        return `<p>${label}: ${value}</p>`;
    }).join('');

    return `
        <tr>
            <td style="padding: 8px;">${lead.Name}</td>
            <td style="padding: 8px;">${date}</td>
            <td style="padding: 8px;">${legalStatus}</td>
            <td style="padding: 8px;">${additionalDetails}</td>
        </tr>
    `;
}

downloadDocument(htmlContent) {
    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/octet-stream'
    });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = `${this.selectedLabel}_Report.doc`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
}
}
