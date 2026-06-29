
import { useEffect, useState } from "react";
import LicenseBanner from "./LicenseBanner";
import {useGetGlobalConfigQuery,} from '../../../redux/globalApiSlice';

const ONE_DAY = 24 * 60 * 60 * 1000;

const TWO_DAYS = 2 * ONE_DAY;

const LicenseManager = () => {
    const [banner, setBanner] =useState(null);
    const { data: existingConfig } = useGetGlobalConfigQuery();
    
    const shouldShowBanner = ( licenseType,remainingDays,lastShown) => {

    const now = Date.now();

    const diff =now - Number(lastShown || 0);
    
    if (remainingDays <= 0) {
      return true;
    }

    // trial
    if (licenseType === "trial") {

      if (remainingDays <= 7) {
        return diff >= ONE_DAY;
      }

      return false;
    }

    // enterprise
    if (licenseType === "enterprise") {

      if (remainingDays <= 15) {
        return diff >= ONE_DAY;
      }

      if (remainingDays <= 30) {
        return diff >= TWO_DAYS;
      }
    }

    return false;
  };

    const checkLicense = async () => {

        try {

        if (!existingConfig) {
        return;
        } 
        
        const role = existingConfig?._user?.role;
        if (role !== "Administrator") {
            return;
        }

        const licenseType =existingConfig["license.license_type"];

        const remainingDays =existingConfig["license.remaining_days"];
        
        // const isExpired = existingConfig["license.status"] === "expired";
        const isExpired = remainingDays <= 0;
        const lastShown =
            localStorage.getItem(
            "license_banner_last_shown"
            );
      
        

        const shouldShow =
            shouldShowBanner(
            licenseType,
            remainingDays,
            lastShown,
            );

        if (!shouldShow) {
            return;
        }

        let message = "";

        if (remainingDays <= 0) {

            message ="Your license has expired.";

        } 
        else if (licenseType === "trial") {
            message =`Your trial license will expire in ${remainingDays} days. Please upgrade your license.`;

        } 
        else {
            message =`Your enterprise license will expire in ${remainingDays} days. Please renew your subscription.`;
        }

        setBanner({message, isExpired});

        localStorage.setItem("license_banner_last_shown",Date.now());

        } catch (err) {
        console.error( "[LicenseManager]", err);
        }
    };

  useEffect(() => {

    checkLicense();
    const interval = setInterval(() => {
      checkLicense();
    }, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [existingConfig]);

  return (
    <>
      {banner && (
        <LicenseBanner
          message={banner.message}
          isExpired={banner.isExpired}
          onClose={() => setBanner(null)}
        />
      )}
    </>
  );
}

export default LicenseManager
