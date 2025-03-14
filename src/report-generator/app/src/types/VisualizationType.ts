/**
 * Enum representing different types of visualizations available in the report generator.
 * These visualizations are used to display various aspects of web tracking and third-party requests.
 */
export enum VisualizationType {
    /**
     * Visualization showing the number of websites connecting to Trackers.
     * Trackers are services that can be related to tracking or advertising that the websites may be using.
     */
    TrackersWebsite = 'trackersWebsite',

    /**
     * Visualization showing the number of websites that make requests to each eTLD+1 (registered domain).
     * We count unique websites connecting to each domain. Tracking services and companies can use multiple
     * different domains.
     */
    EtldPlus1Websites = 'etldPlus1Websites',

    /**
     * Visualization showing the number of websites connecting to a Company.
     * Company is a company that the trackers belong to. A single company can provide multiple different services.
     */
    CompaniesWebsites = 'companiesWebsites',
}
