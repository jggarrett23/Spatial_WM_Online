if (!require('rjson')) install.packages('package')
library(rjson)

setwd('/Users/owner/Desktop/jatos_mac_java/study_assets_root/Spatial_WM_Online_Task/analysis/')
result <- fromJSON(file = "jatos_results_20210108003931")

samp.probe_angles <- unlist(result$SampleProbeAngles)
resp.probe_angles <- unlist(result$RespProbeAngles)

error <- abs(samp.probe_angles - resp.probe_angles)

print(paste0('Avg Error: ',round(mean(error),2),'\u00B0'))
print(paste0('Stdv Error: ',round(sd(error),2),'\u00B0'))